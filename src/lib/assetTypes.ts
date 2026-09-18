/** Client-safe asset vocabulary shared by the admin tools and the public card display. */

export const ASSET_TYPES = [
  "PLAYER_CARD",
  "CARD_BACKGROUND",
  "PLAYER_PORTRAIT",
  "EVENT",
  "GAME_MODE",
  "COMPETITION",
  "NEWS",
  "BANNER",
  "LOGO",
  "ICON",
  "OTHER",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<string, string> = {
  PLAYER_CARD: "Player card",
  CARD_BACKGROUND: "Card background",
  PLAYER_PORTRAIT: "Player portrait",
  EVENT: "Event",
  GAME_MODE: "Game mode",
  COMPETITION: "Competition",
  NEWS: "News",
  BANNER: "Banner",
  LOGO: "Logo",
  ICON: "Icon",
  OTHER: "Other",
};

export function assetTypeLabel(type: string): string {
  return ASSET_TYPE_LABELS[type] ?? type;
}

export type AssetSource = "upload" | "external" | "imported";

export const ASSET_SOURCE_LABELS: Record<string, string> = {
  upload: "Uploaded",
  external: "External URL",
  imported: "Imported from URL",
};

export type AssetRecord = {
  id: string;
  name: string;
  type: string;
  source: AssetSource;
  url: string;
  mimeType: string;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  usageCount: number;
};

/** Formats supported everywhere in the system. */
export const SUPPORTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
] as const;

export const UPLOAD_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.svg";

export const MAX_ASSET_BYTES = 15 * 1024 * 1024;

export function isSupportedMime(mime: string): boolean {
  const base = (mime.split(";")[0] ?? "").trim().toLowerCase();
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(base);
}

export function isHttpUrl(value: string): boolean {
  const v = value.trim();
  if (!/^https?:\/\/\S+$/i.test(v)) return false;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDimensions(width: number | null, height: number | null): string {
  return width && height ? `${width} × ${height}` : "—";
}
