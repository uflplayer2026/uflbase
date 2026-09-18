/** Server-only image validation: format sniffing and dimension reading from raw bytes. */

export type ProbeResult = { mime: string; width: number | null; height: number | null };

const startsWith = (b: Uint8Array, sig: number[], offset = 0) =>
  sig.every((v, i) => b[offset + i] === v);

function readUint32BE(b: Uint8Array, o: number) {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

function pngSize(b: Uint8Array) {
  return { width: readUint32BE(b, 16), height: readUint32BE(b, 20) };
}

function gifSize(b: Uint8Array) {
  return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
}

function webpSize(b: Uint8Array): { width: number | null; height: number | null } {
  const fourcc = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (fourcc === "VP8X") {
    return {
      width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
      height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
    };
  }
  if (fourcc === "VP8 ") {
    return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
  }
  if (fourcc === "VP8L") {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return { width: null, height: null };
}

function jpegSize(b: Uint8Array): { width: number | null; height: number | null } {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1];
    const length = (b[i + 2] << 8) | b[i + 3];
    // SOF0..SOF15 excluding DHT/JPG/DAC markers
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    if (length <= 0) break;
    i += 2 + length;
  }
  return { width: null, height: null };
}

/** Rejects SVG payloads that could execute script in a browser. */
function svgIsSafe(text: string): boolean {
  const lower = text.toLowerCase();
  if (!lower.includes("<svg")) return false;
  const dangerous = ["<script", "<foreignobject", "javascript:", "<iframe", "<embed", "<object"];
  if (dangerous.some((d) => lower.includes(d))) return false;
  return !/\son\w+\s*=/i.test(lower);
}

/**
 * Determines the real format from the bytes themselves — the declared content type
 * of uploads and remote URLs is untrusted.
 */
export function probeImage(bytes: Uint8Array, declaredMime = ""): ProbeResult {
  if (bytes.length < 16) throw new Error("The file is empty or corrupted.");

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    const { width, height } = pngSize(bytes);
    if (!width || !height) throw new Error("The PNG file is corrupted.");
    return { mime: "image/png", width, height };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    const { width, height } = jpegSize(bytes);
    return { mime: "image/jpeg", width, height };
  }
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) {
    const { width, height } = gifSize(bytes);
    return { mime: "image/gif", width, height };
  }
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    const { width, height } = webpSize(bytes);
    return { mime: "image/webp", width, height };
  }

  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 4096));
  if (head.includes("<svg") || head.trimStart().startsWith("<?xml")) {
    const full = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (!svgIsSafe(full)) {
      throw new Error("This SVG contains scripting and was rejected for safety.");
    }
    const w = /width\s*=\s*"(\d+(?:\.\d+)?)/i.exec(full);
    const h = /height\s*=\s*"(\d+(?:\.\d+)?)/i.exec(full);
    return {
      mime: "image/svg+xml",
      width: w ? Math.round(Number(w[1])) : null,
      height: h ? Math.round(Number(h[1])) : null,
    };
  }

  throw new Error(
    declaredMime
      ? `Unsupported or corrupted image (${declaredMime}). Use PNG, JPG, WebP, GIF or SVG.`
      : "Unsupported or corrupted image file. Use PNG, JPG, WebP, GIF or SVG.",
  );
}

export function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "bin";
  }
}
