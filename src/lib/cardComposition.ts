/**
 * Card composition geometry.
 *
 * A Card Image is a layered element placed inside a Card Background's safe area.
 * Everything here is pure maths on percentages of the card container, so the same
 * result holds at every viewport width (no fixed pixel positioning, no object-fit
 * cover cropping).
 */

export type SafeArea = {
  /** Distances from the card container edges, in % of the container. */
  top: number;
  right: number;
  bottom: number;
  left: number;
  /** Optional caps, in % of the container. */
  maxWidth: number;
  maxHeight: number;
  alignX: "start" | "center" | "end";
  alignY: "start" | "center" | "end";
};

export type ProtectedArea = {
  label: string;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/** Per-card manual override. Automatic composition is the default. */
export type CompositionOverride = {
  /** 0.4 – 1.4, relative to the automatically computed size. */
  scale: number;
  /** Offsets in % of the container. */
  x: number;
  y: number;
};

export const DEFAULT_SAFE_AREA: SafeArea = {
  top: 6,
  right: 8,
  bottom: 22,
  left: 8,
  maxWidth: 100,
  maxHeight: 100,
  alignX: "center",
  alignY: "center",
};

/** Card media containers are rendered at this aspect ratio (width / height). */
export const CARD_ASPECT = 3 / 4;

export type Box = { x: number; y: number; w: number; h: number };

export function normalizeSafeArea(value: unknown): SafeArea {
  const v = (value ?? {}) as Partial<SafeArea>;
  const n = (raw: unknown, fallback: number) => {
    const num = Number(raw);
    return Number.isFinite(num) ? Math.min(100, Math.max(0, num)) : fallback;
  };
  const align = (raw: unknown, fallback: SafeArea["alignX"]) =>
    raw === "start" || raw === "center" || raw === "end" ? raw : fallback;
  return {
    top: n(v.top, DEFAULT_SAFE_AREA.top),
    right: n(v.right, DEFAULT_SAFE_AREA.right),
    bottom: n(v.bottom, DEFAULT_SAFE_AREA.bottom),
    left: n(v.left, DEFAULT_SAFE_AREA.left),
    maxWidth: n(v.maxWidth, DEFAULT_SAFE_AREA.maxWidth) || 100,
    maxHeight: n(v.maxHeight, DEFAULT_SAFE_AREA.maxHeight) || 100,
    alignX: align(v.alignX, DEFAULT_SAFE_AREA.alignX),
    alignY: align(v.alignY, DEFAULT_SAFE_AREA.alignY),
  };
}

export function normalizeProtectedAreas(value: unknown): ProtectedArea[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const v = (raw ?? {}) as Partial<ProtectedArea>;
      const n = (x: unknown) => {
        const num = Number(x);
        return Number.isFinite(num) ? Math.min(100, Math.max(0, num)) : 0;
      };
      return {
        label: typeof v.label === "string" ? v.label : "Protected area",
        top: n(v.top),
        right: n(v.right),
        bottom: n(v.bottom),
        left: n(v.left),
      };
    })
    .filter((a) => 100 - a.left - a.right > 0 && 100 - a.top - a.bottom > 0);
}

export function normalizeOverride(value: unknown): CompositionOverride | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<CompositionOverride>;
  const scale = Number(v.scale);
  const x = Number(v.x);
  const y = Number(v.y);
  if (!Number.isFinite(scale) && !Number.isFinite(x) && !Number.isFinite(y)) return null;
  return {
    scale: Number.isFinite(scale) ? Math.min(1.4, Math.max(0.4, scale)) : 1,
    x: Number.isFinite(x) ? Math.min(40, Math.max(-40, x)) : 0,
    y: Number.isFinite(y) ? Math.min(40, Math.max(-40, y)) : 0,
  };
}

function safeBox(area: SafeArea): Box {
  const x = area.left;
  const y = area.top;
  return {
    x,
    y,
    w: Math.max(0, 100 - area.left - area.right),
    h: Math.max(0, 100 - area.top - area.bottom),
  };
}

function overlap(a: Box, b: Box) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? { w, h } : null;
}

function toBox(area: ProtectedArea): Box {
  return {
    x: area.left,
    y: area.top,
    w: Math.max(0, 100 - area.left - area.right),
    h: Math.max(0, 100 - area.top - area.bottom),
  };
}

/**
 * Trims the usable box away from protected regions. Each protected area is removed
 * with the single cut (top / bottom / left / right) that costs the least area, so
 * decorative frames, rating badges and name plates stay clear.
 */
function avoidProtected(box: Box, areas: ProtectedArea[]): Box {
  let current = box;
  for (const area of areas) {
    const p = toBox(area);
    const hit = overlap(current, p);
    if (!hit) continue;

    const candidates: Box[] = [
      // cut from the top
      { ...current, y: p.y + p.h, h: current.y + current.h - (p.y + p.h) },
      // cut from the bottom
      { ...current, h: p.y - current.y },
      // cut from the left
      { ...current, x: p.x + p.w, w: current.x + current.w - (p.x + p.w) },
      // cut from the right
      { ...current, w: p.x - current.x },
    ].filter((c) => c.w > 8 && c.h > 8);

    if (candidates.length === 0) continue;
    current = candidates.reduce((best, c) => (c.w * c.h > best.w * best.h ? c : best));
  }
  return current;
}

export type CompositionResult = {
  /** Percentages of the card container. */
  left: number;
  top: number;
  width: number;
  height: number;
  automatic: boolean;
};

/**
 * Fits an image of any resolution or aspect ratio inside the safe area:
 * aspect ratio is preserved, the box never leaves the safe area, and a
 * 1024×1024 and a 512×768 source end up visually consistent.
 */
export function computeComposition(input: {
  safeArea?: SafeArea | null;
  protectedAreas?: ProtectedArea[] | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  override?: CompositionOverride | null;
  cardAspect?: number;
}): CompositionResult {
  const area = input.safeArea ?? DEFAULT_SAFE_AREA;
  const cardAspect = input.cardAspect && input.cardAspect > 0 ? input.cardAspect : CARD_ASPECT;

  let box = safeBox(area);
  box = avoidProtected(box, input.protectedAreas ?? []);
  box = {
    ...box,
    w: Math.min(box.w, area.maxWidth),
    h: Math.min(box.h, area.maxHeight),
  };

  const iw = input.imageWidth && input.imageWidth > 0 ? input.imageWidth : 3;
  const ih = input.imageHeight && input.imageHeight > 0 ? input.imageHeight : 4;
  // Aspect ratio expressed in container-percentage space.
  const ratio = iw / ih / cardAspect;

  let height = box.h;
  let width = height * ratio;
  if (width > box.w) {
    width = box.w;
    height = width / ratio;
  }

  const override = input.override ?? null;
  if (override) {
    width *= override.scale;
    height *= override.scale;
    // Never let an override push the image outside the safe area.
    if (width > box.w) {
      const k = box.w / width;
      width *= k;
      height *= k;
    }
    if (height > box.h) {
      const k = box.h / height;
      width *= k;
      height *= k;
    }
  }

  const align = (start: number, span: number, size: number, mode: "start" | "center" | "end") =>
    mode === "start" ? start : mode === "end" ? start + span - size : start + (span - size) / 2;

  let left = align(box.x, box.w, width, area.alignX);
  let top = align(box.y, box.h, height, area.alignY);

  if (override) {
    left = Math.min(box.x + box.w - width, Math.max(box.x, left + override.x));
    top = Math.min(box.y + box.h - height, Math.max(box.y, top + override.y));
  }

  return {
    left: Number(left.toFixed(3)),
    top: Number(top.toFixed(3)),
    width: Number(width.toFixed(3)),
    height: Number(height.toFixed(3)),
    automatic: !override,
  };
}

/** Inline style for the composed card image layer. */
export function compositionStyle(result: CompositionResult): React.CSSProperties {
  return {
    position: "absolute",
    left: `${result.left}%`,
    top: `${result.top}%`,
    width: `${result.width}%`,
    height: `${result.height}%`,
    objectFit: "contain",
    objectPosition: "center",
  };
}
