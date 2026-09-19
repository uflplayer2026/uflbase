import {
  DRIVE_FOLDER_TYPES,
  DRIVE_ROOT_FOLDER,
  isSupportedMime,
  MAX_ASSET_BYTES,
  type DriveAssetRecord,
  type DriveImportMode,
  type DriveSyncStatus,
} from "./assetTypes";
import { matchFileName } from "./assetMatching";
import { variantKey } from "./cardIdentity";

/**
 * One reusable Google Drive ingestion pipeline for every asset category.
 * Folders define the category; the Drive file ID is the stable asset identity.
 * A single failing file never stops the rest of the synchronization.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const STATE_ID = "drive";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function driveConfig() {
  return {
    lovableKey: process.env["LOVABLE_API_KEY"] ?? "",
    connectionKey: process.env["GOOGLE_DRIVE_API_KEY"] ?? "",
  };
}

export class DriveError extends Error {
  kind: "config" | "auth" | "permission" | "not_found" | "rate_limit" | "provider" | "unknown";
  constructor(kind: DriveError["kind"], message: string) {
    super(message);
    this.name = "DriveError";
    this.kind = kind;
  }
}

function classify(status: number, body: string): DriveError {
  const lower = body.toLowerCase();
  if (status === 401)
    return new DriveError(
      "auth",
      "Google Drive authentication expired. Reconnect Google Drive to continue importing assets.",
    );
  if (status === 403) {
    if (lower.includes("scope") || lower.includes("insufficient"))
      return new DriveError(
        "permission",
        "The Google Drive connection is missing file read permission. Reconnect and allow Drive access.",
      );
    return new DriveError("permission", "Google denied access to this Drive file or folder.");
  }
  if (status === 404) return new DriveError("not_found", "The Drive file or folder no longer exists.");
  if (status === 429) return new DriveError("rate_limit", "Google Drive rate limit reached. Try again shortly.");
  if (status >= 500) return new DriveError("provider", `Google Drive is temporarily unavailable (${status}).`);
  return new DriveError("unknown", `Google Drive returned an unexpected error (${status}).`);
}

async function driveFetch(path: string, params: Record<string, string> = {}): Promise<Response> {
  const c = driveConfig();
  if (!c.lovableKey || !c.connectionKey) {
    throw new DriveError(
      "config",
      "Google Drive is not connected to this project. Connect Google Drive first.",
    );
  }
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${GATEWAY}${path}${query ? `?${query}` : ""}`, {
    headers: {
      Authorization: `Bearer ${c.lovableKey}`,
      "X-Connection-Api-Key": c.connectionKey,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    // Never log credentials — status, classification and Google's message only.
    console.error(`[drive] request failed path=${path} status=${res.status}: ${body}`);
    throw classify(res.status, body);
  }
  return res;
}

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
};

async function listChildren(parentId: string, extraQuery: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await driveFetch("/files", {
      q: `'${parentId}' in parents and trashed=false${extraQuery}`,
      fields: "nextPageToken, files(id,name,mimeType,size,modifiedTime)",
      pageSize: "1000",
      ...(pageToken ? { pageToken } : {}),
    });
    const json = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
    files.push(...(json.files ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return files;
}

async function readState() {
  const db = await admin();
  const { data, error } = await db.from("drive_sync_state").select("*").eq("id", STATE_ID).maybeSingle();
  if (error) throw error;
  return data;
}

async function writeState(patch: Record<string, unknown>) {
  const db = await admin();
  const { error } = await db
    .from("drive_sync_state")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", STATE_ID);
  if (error) throw error;
}

async function findRootFolder(cached: string | null): Promise<string> {
  if (cached) {
    try {
      const res = await driveFetch(`/files/${cached}`, { fields: "id,trashed" });
      const json = (await res.json()) as { id: string; trashed?: boolean };
      if (!json.trashed) return json.id;
    } catch {
      // fall through to a fresh lookup
    }
  }
  const res = await driveFetch("/files", {
    q: `mimeType='application/vnd.google-apps.folder' and name='${DRIVE_ROOT_FOLDER}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: "10",
  });
  const json = (await res.json()) as { files?: DriveFile[] };
  const folder = json.files?.[0];
  if (!folder) {
    throw new DriveError(
      "not_found",
      `No “${DRIVE_ROOT_FOLDER}” folder was found in the connected Google Drive. Create it with the category subfolders inside.`,
    );
  }
  await writeState({ root_folder_id: folder.id });
  return folder.id;
}

async function downloadDriveFile(fileId: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const res = await driveFetch(`/files/${fileId}`, { alt: "media" });
  const declared = res.headers.get("content-type") ?? "";
  const buffer = new Uint8Array(await res.arrayBuffer());
  if (buffer.byteLength > MAX_ASSET_BYTES) throw new Error("The file is larger than 15 MB.");
  return { bytes: buffer, mime: declared };
}

type DriveRow = {
  drive_file_id: string;
  name: string;
  folder: string;
  asset_type: string;
  mime_type: string;
  file_size: number | null;
  drive_modified_at: string | null;
  status: string;
  error: string | null;
  asset_id: string | null;
  match_group: string | null;
  matched_variant_key: string | null;
  detected_at: string;
  updated_at: string;
};

function toRecord(row: DriveRow): DriveAssetRecord {
  return {
    driveFileId: row.drive_file_id,
    name: row.name,
    folder: row.folder,
    type: row.asset_type,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    driveModifiedAt: row.drive_modified_at,
    status: row.status,
    error: row.error,
    assetId: row.asset_id,
    matchGroup: row.match_group,
    detectedAt: row.detected_at,
    updatedAt: row.updated_at,
  };
}

/** Imports one detected Drive file, optionally letting it participate immediately. */
export async function importDriveFile(
  driveFileId: string,
  options: { apply: boolean; replaceExisting?: boolean },
): Promise<DriveAssetRecord> {
  const db = await admin();
  const { data, error } = await db
    .from("drive_assets")
    .select("*")
    .eq("drive_file_id", driveFileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That Drive file is no longer tracked.");
  const row = data as DriveRow;

  try {
    if (row.mime_type && !isSupportedMime(row.mime_type)) {
      throw new Error(`Unsupported format (${row.mime_type}).`);
    }
    const { bytes, mime } = await downloadDriveFile(row.drive_file_id);
    const { upsertDriveAsset } = await import("./assets.server");
    const { asset } = await upsertDriveAsset({
      driveFileId: row.drive_file_id,
      name: row.name,
      folder: row.folder,
      type: row.asset_type,
      bytes,
      declaredMime: mime || row.mime_type,
      driveModifiedAt: row.drive_modified_at,
    });

    let status = "IMPORTED";
    let matchGroup: string | null = null;
    let matchedKey: string | null = null;

    // Card images may be matched to an existing card using the existing safe matcher.
    if (options.apply && row.asset_type === "PLAYER_CARD") {
      const { getSnapshotWithoutSync } = await import("./sheets.server");
      const { players } = await getSnapshotWithoutSync();
      const match = matchFileName(row.name, players);
      matchGroup = match.group;
      if (match.group === "matched" && match.candidates[0]) {
        const key = variantKey(match.candidates[0].player);
        matchedKey = key;
        const { assignCardImages } = await import("./assets.server");
        const result = await assignCardImages([{ variantKey: key, assetId: asset.id }], {
          replaceExisting: Boolean(options.replaceExisting),
        });
        status = result.assigned > 0 ? "IN_USE" : "IMPORTED";
      } else {
        status = match.group === "review" ? "REVIEW" : "UNMATCHED";
      }
    }

    const { data: updated, error: updateError } = await db
      .from("drive_assets")
      .update({
        status,
        error: null,
        asset_id: asset.id,
        match_group: matchGroup,
        matched_variant_key: matchedKey,
        updated_at: new Date().toISOString(),
      })
      .eq("drive_file_id", row.drive_file_id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    return toRecord(updated as DriveRow);
  } catch (err) {
    const message = err instanceof Error ? err.message : "The import failed.";
    const { data: failedRow } = await db
      .from("drive_assets")
      .update({ status: "FAILED", error: message, updated_at: new Date().toISOString() })
      .eq("drive_file_id", row.drive_file_id)
      .select("*")
      .single();
    return toRecord(failedRow as DriveRow);
  }
}

export async function setDriveStatus(driveFileId: string, status: string) {
  const db = await admin();
  const { error } = await db
    .from("drive_assets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("drive_file_id", driveFileId);
  if (error) throw error;
}

export async function setImportMode(mode: DriveImportMode) {
  await writeState({ import_mode: mode });
}

export async function listDriveAssets(params: {
  status?: string | undefined;
  type?: string | undefined;
  limit?: number | undefined;
}): Promise<DriveAssetRecord[]> {
  const db = await admin();
  let query = db
    .from("drive_assets")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(Math.min(params.limit ?? 200, 500));
  if (params.status) query = query.eq("status", params.status);
  if (params.type) query = query.eq("asset_type", params.type);
  const { data, error } = await query;
  if (error) throw error;
  return (data as DriveRow[]).map(toRecord);
}

export async function getDriveStatus(): Promise<DriveSyncStatus> {
  const state = await readState();
  const db = await admin();
  const { data } = await db.from("drive_assets").select("status");
  const rows = (data ?? []) as { status: string }[];
  const count = (...statuses: string[]) => rows.filter((r) => statuses.includes(r.status)).length;
  const c = driveConfig();
  return {
    connected: Boolean(c.lovableKey && c.connectionKey),
    importMode: (state?.import_mode ?? "manual") as DriveImportMode,
    rootFolderId: state?.root_folder_id ?? null,
    lastSyncAt: state?.last_sync_at ?? null,
    lastStatus: state?.last_status ?? null,
    lastError: state?.last_error ?? null,
    counters: {
      detected: rows.length,
      imported: count("IMPORTED", "IN_USE", "UPDATED"),
      waiting: count("DETECTED", "READY", "NEW"),
      failed: count("FAILED"),
      updated: count("UPDATED"),
      unmatched: count("UNMATCHED", "REVIEW"),
    },
    syncing: Boolean(state?.sync_running),
  };
}

export type DriveSyncOutcome = {
  status: "success" | "failed" | "skipped";
  message: string;
  detected: number;
  imported: number;
  failed: number;
  waiting: number;
};

/**
 * Periodic (and on-demand) Drive synchronization: detect, classify by folder,
 * validate, then import according to the configured mode.
 */
export async function syncDrive(): Promise<DriveSyncOutcome> {
  const db = await admin();
  const state = await readState();
  if (state?.sync_running) {
    const startedAgo = state.updated_at ? Date.now() - new Date(state.updated_at).getTime() : 0;
    if (startedAgo < 5 * 60_000) {
      return {
        status: "skipped",
        message: "A Drive synchronization is already running.",
        detected: 0,
        imported: 0,
        failed: 0,
        waiting: 0,
      };
    }
  }
  await writeState({ sync_running: true });

  const mode = (state?.import_mode ?? "manual") as DriveImportMode;
  let detected = 0;
  let imported = 0;
  let failed = 0;
  let waiting = 0;

  try {
    const rootId = await findRootFolder(state?.root_folder_id ?? null);
    const folders = await listChildren(
      rootId,
      " and mimeType='application/vnd.google-apps.folder'",
    );
    const byName = new Map(folders.map((f) => [f.name.trim().toLowerCase(), f]));

    for (const mapping of DRIVE_FOLDER_TYPES) {
      const folder = byName.get(mapping.folder.toLowerCase());
      if (!folder) continue;

      let files: DriveFile[];
      try {
        files = await listChildren(folder.id, " and mimeType contains 'image/'");
      } catch (err) {
        console.error(`[drive] folder listing failed folder=${mapping.folder}`, err);
        continue;
      }

      const ids = files.map((f) => f.id);
      const known = new Map<string, DriveRow>();
      for (let i = 0; i < ids.length; i += 300) {
        const { data } = await db
          .from("drive_assets")
          .select("*")
          .in("drive_file_id", ids.slice(i, i + 300));
        for (const row of (data ?? []) as DriveRow[]) known.set(row.drive_file_id, row);
      }

      const toProcess: string[] = [];
      const rows = files.map((file) => {
        const previous = known.get(file.id);
        const modified = file.modifiedTime ?? null;
        const changed =
          !previous ||
          previous.drive_modified_at !== modified ||
          previous.asset_type !== mapping.type;
        // A renamed file keeps its row: the Drive file ID is the identity.
        const status = previous
          ? changed && previous.status !== "IGNORED"
            ? "UPDATED"
            : previous.status
          : "DETECTED";
        if (
          changed &&
          previous?.status !== "IGNORED" &&
          (mode === "automatic" || mode === "automatic_apply")
        ) {
          toProcess.push(file.id);
        }
        detected += 1;
        return {
          drive_file_id: file.id,
          name: file.name,
          folder: mapping.folder,
          asset_type: mapping.type,
          mime_type: file.mimeType,
          file_size: file.size ? Number(file.size) : null,
          drive_modified_at: modified,
          status,
          updated_at: new Date().toISOString(),
        };
      });

      for (let i = 0; i < rows.length; i += 300) {
        const { error } = await db
          .from("drive_assets")
          .upsert(rows.slice(i, i + 300), { onConflict: "drive_file_id" });
        if (error) throw error;
      }

      for (const fileId of toProcess) {
        const result = await importDriveFile(fileId, { apply: mode === "automatic_apply" });
        if (result.status === "FAILED") failed += 1;
        else imported += 1;
      }
    }

    const { data: pending } = await db
      .from("drive_assets")
      .select("status")
      .in("status", ["DETECTED", "READY", "NEW", "UPDATED"]);
    waiting = (pending ?? []).length;

    const message =
      mode === "manual"
        ? `${detected} files detected · ${waiting} waiting for approval.`
        : `${detected} files detected · ${imported} imported${failed ? ` · ${failed} failed` : ""}.`;

    await writeState({
      sync_running: false,
      last_sync_at: new Date().toISOString(),
      last_status: "success",
      last_error: null,
      counters: { detected, imported, failed, waiting },
    });
    return { status: "success", message, detected, imported, failed, waiting };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Drive synchronization failed.";
    await writeState({
      sync_running: false,
      last_sync_at: new Date().toISOString(),
      last_status: "failed",
      last_error: message,
    });
    return { status: "failed", message, detected, imported, failed, waiting };
  }
}
