import type { ProtectedArea, SafeArea } from "./cardComposition";

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

export type AssetSource = "upload" | "external" | "imported" | "drive";

export const ASSET_SOURCE_LABELS: Record<string, string> = {
  upload: "Uploaded",
  external: "External URL",
  imported: "Imported from URL",
  drive: "Google Drive",
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
  driveFileId: string | null;
  driveFolder: string | null;
  driveModifiedAt: string | null;
  importStatus: string;
  tags: string[];
  /** Card backgrounds only: composition geometry for the card image layer. */
  safeArea: SafeArea | null;
  protectedAreas: ProtectedArea[];
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

/* ------------------------- Google Drive asset pipeline ------------------------- */

/** Dedicated Drive root; each subfolder explicitly defines the asset category. */
export const DRIVE_ROOT_FOLDER = "UFLBase Assets";

export const DRIVE_FOLDER_TYPES: { folder: string; type: AssetType }[] = [
  { folder: "Card Backgrounds", type: "CARD_BACKGROUND" },
  { folder: "Player Card Images", type: "PLAYER_CARD" },
  { folder: "Player Portraits", type: "PLAYER_PORTRAIT" },
  { folder: "Events", type: "EVENT" },
  { folder: "Game Modes", type: "GAME_MODE" },
  { folder: "Competitions", type: "COMPETITION" },
  { folder: "News", type: "NEWS" },
  { folder: "Banners", type: "BANNER" },
  { folder: "Logos", type: "LOGO" },
  { folder: "Icons", type: "ICON" },
  { folder: "Other", type: "OTHER" },
];

export const IMPORT_STATUSES = [
  "NEW",
  "DETECTED",
  "READY",
  "IMPORTED",
  "IN_USE",
  "UPDATED",
  "REVIEW",
  "UNMATCHED",
  "FAILED",
  "IGNORED",
  "MISSING",
] as const;

export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const IMPORT_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  DETECTED: "Detected",
  READY: "Ready",
  IMPORTED: "Imported",
  IN_USE: "In use",
  UPDATED: "Updated",
  REVIEW: "Review",
  UNMATCHED: "Unmatched",
  FAILED: "Failed",
  IGNORED: "Ignored",
  MISSING: "Missing in Drive",
};

export const DRIVE_IMPORT_MODES = ["manual", "automatic", "automatic_apply"] as const;
export type DriveImportMode = (typeof DRIVE_IMPORT_MODES)[number];

export const DRIVE_IMPORT_MODE_LABELS: Record<DriveImportMode, string> = {
  manual: "Manual approval",
  automatic: "Automatic import",
  automatic_apply: "Automatic import + apply",
};

export type DriveAssetRecord = {
  driveFileId: string;
  name: string;
  folder: string;
  type: string;
  mimeType: string;
  fileSize: number | null;
  driveModifiedAt: string | null;
  status: string;
  error: string | null;
  assetId: string | null;
  matchGroup: string | null;
  retryCount: number;
  failedAt: string | null;
  detectedAt: string;
  updatedAt: string;
};

export type DriveSyncStatus = {
  connected: boolean;
  importMode: DriveImportMode;
  rootFolderId: string | null;
  lastSyncAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastErrorKind: string | null;
  authRequired: boolean;
  autoSyncEnabled: boolean;
  intervalMinutes: number;
  nextScheduledAt: string | null;
  lastSchedulerRunAt: string | null;
  lastTrigger: string | null;
  lastRun: {
    checked: number;
    newFiles: number;
    updatedFiles: number;
    imported: number;
    matched: number;
    review: number;
    unmatched: number;
    failed: number;
    missing: number;
  };
  counters: {
    detected?: number;
    imported?: number;
    waiting?: number;
    failed?: number;
    updated?: number;
    unmatched?: number;
  };
  syncing: boolean;
};
