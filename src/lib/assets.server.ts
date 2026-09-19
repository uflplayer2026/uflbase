import { MAX_ASSET_BYTES, isHttpUrl, type AssetRecord, type AssetSource } from "./assetTypes";
import {
  normalizeOverride,
  normalizeProtectedAreas,
  normalizeSafeArea,
  type CompositionOverride,
  type ProtectedArea,
  type SafeArea,
} from "./cardComposition";
import { extensionForMime, probeImage } from "./imageProbe.server";

const BUCKET = "assets";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type AssetRow = {
  id: string;
  name: string;
  asset_type: string;
  source: string;
  url: string;
  storage_path: string | null;
  mime_type: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
  drive_file_id: string | null;
  drive_folder: string | null;
  drive_modified_at: string | null;
  import_status: string;
  tags: unknown;
  safe_area: unknown;
  protected_areas: unknown;
};

const SELECT =
  "id, name, asset_type, source, url, storage_path, mime_type, file_size, width, height, created_at, drive_file_id, drive_folder, drive_modified_at, import_status, tags, safe_area, protected_areas";

function toRecord(row: AssetRow, usageCount = 0): AssetRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.asset_type,
    source: row.source as AssetSource,
    url: row.url,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    usageCount,
    driveFileId: row.drive_file_id,
    driveFolder: row.drive_folder,
    driveModifiedAt: row.drive_modified_at,
    importStatus: row.import_status ?? "IMPORTED",
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    safeArea: row.safe_area ? normalizeSafeArea(row.safe_area) : null,
    protectedAreas: normalizeProtectedAreas(row.protected_areas),
  };
}

/** Public serving path for a privately stored file (bucket contents are streamed by the app). */
function publicPath(storagePath: string) {
  return `/api/public/asset/${storagePath}`;
}

function slug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "asset"
  );
}

async function usageCounts(): Promise<Map<string, number>> {
  const db = await admin();
  const counts = new Map<string, number>();
  const { data, error } = await db
    .from("card_asset_links")
    .select("card_image_asset_id, background_asset_id");
  if (error) throw error;
  for (const row of data ?? []) {
    for (const id of [row.card_image_asset_id, row.background_asset_id]) {
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

export async function listAssets(params: {
  type?: string | undefined;
  q?: string | undefined;
  limit?: number | undefined;
}): Promise<AssetRecord[]> {
  const db = await admin();
  let query = db
    .from("assets")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(Math.min(params.limit ?? 200, 500));
  if (params.type) query = query.eq("asset_type", params.type);
  if (params.q) query = query.ilike("name", `%${params.q}%`);
  const { data, error } = await query;
  if (error) throw error;
  const counts = await usageCounts();
  return (data as AssetRow[]).map((row) => toRecord(row, counts.get(row.id) ?? 0));
}

async function storeBytes(bytes: Uint8Array, name: string, mime: string, id: string) {
  const db = await admin();
  const path = `${id}/${slug(name)}.${extensionForMime(mime)}`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`Storing the image failed: ${error.message}`);
  return path;
}

function decodeBase64(data: string): Uint8Array {
  const clean = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Downloads a remote image with a hard size cap; never follows non-http schemes. */
async function fetchRemoteImage(url: string): Promise<{ bytes: Uint8Array; declaredMime: string }> {
  if (!isHttpUrl(url)) throw new Error("Not a valid http(s) image URL.");
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch {
    throw new Error("The image could not be downloaded (host unreachable).");
  }
  if (!res.ok) throw new Error(`The image could not be loaded (HTTP ${res.status}).`);
  const declaredMime = res.headers.get("content-type") ?? "";
  const declaredLength = Number(res.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_ASSET_BYTES) throw new Error("The image is larger than 15 MB.");
  const buffer = new Uint8Array(await res.arrayBuffer());
  if (buffer.byteLength > MAX_ASSET_BYTES) throw new Error("The image is larger than 15 MB.");
  return { bytes: buffer, declaredMime };
}

export async function createUploadedAsset(input: {
  name: string;
  type: string;
  base64: string;
}): Promise<AssetRecord> {
  const bytes = decodeBase64(input.base64);
  if (bytes.byteLength > MAX_ASSET_BYTES) throw new Error("The file is larger than 15 MB.");
  const probe = probeImage(bytes);
  const db = await admin();
  const id = crypto.randomUUID();
  const path = await storeBytes(bytes, input.name, probe.mime, id);
  const { data, error } = await db
    .from("assets")
    .insert({
      id,
      name: input.name,
      asset_type: input.type,
      source: "upload",
      url: publicPath(path),
      storage_path: path,
      mime_type: probe.mime,
      file_size: bytes.byteLength,
      width: probe.width,
      height: probe.height,
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return toRecord(data as AssetRow);
}

/**
 * Registers a remote image. `mode: "import"` downloads it into UFLBase storage so the
 * asset no longer depends on the external site; `mode: "external"` keeps the link.
 */
export async function createUrlAsset(input: {
  name?: string | undefined;
  type: string;
  url: string;
  mode: "external" | "import";
}): Promise<AssetRecord> {
  const url = input.url.trim();
  if (!isHttpUrl(url)) throw new Error("That is not a valid image URL.");
  const { bytes, declaredMime } = await fetchRemoteImage(url);
  const probe = probeImage(bytes, declaredMime);

  const fileName = decodeURIComponent(new URL(url).pathname.split("/").pop() || "image");
  const name = (input.name ?? "").trim() || fileName;

  const db = await admin();
  const id = crypto.randomUUID();
  const path = input.mode === "import" ? await storeBytes(bytes, name, probe.mime, id) : null;

  const { data, error } = await db
    .from("assets")
    .insert({
      id,
      name,
      asset_type: input.type,
      source: input.mode === "import" ? "imported" : "external",
      url: path ? publicPath(path) : url,
      storage_path: path,
      mime_type: probe.mime,
      file_size: bytes.byteLength,
      width: probe.width,
      height: probe.height,
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return toRecord(data as AssetRow);
}

export async function renameAsset(id: string, name: string, type?: string) {
  const db = await admin();
  const { error } = await db
    .from("assets")
    .update({
      name,
      updated_at: new Date().toISOString(),
      ...(type ? { asset_type: type } : {}),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Replaces the bytes of an existing asset, keeping its id and every card assignment. */
export async function replaceAssetFile(id: string, base64: string): Promise<AssetRecord> {
  const bytes = decodeBase64(base64);
  if (bytes.byteLength > MAX_ASSET_BYTES) throw new Error("The file is larger than 15 MB.");
  const probe = probeImage(bytes);
  const db = await admin();
  const { data: existing, error: readError } = await db
    .from("assets")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (readError) throw readError;
  if (!existing) throw new Error("That asset no longer exists.");

  const row = existing as AssetRow;
  if (row.storage_path) await db.storage.from(BUCKET).remove([row.storage_path]);
  const path = await storeBytes(bytes, row.name, probe.mime, id);

  const { data, error } = await db
    .from("assets")
    .update({
      source: "upload",
      url: publicPath(path),
      storage_path: path,
      mime_type: probe.mime,
      file_size: bytes.byteLength,
      width: probe.width,
      height: probe.height,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw error;
  return toRecord(data as AssetRow);
}

export async function deleteAsset(id: string) {
  const db = await admin();
  const { data } = await db.from("assets").select("storage_path").eq("id", id).maybeSingle();
  const path = (data as { storage_path: string | null } | null)?.storage_path;
  if (path) await db.storage.from(BUCKET).remove([path]);
  const { error } = await db.from("assets").delete().eq("id", id);
  if (error) throw error;
}

export async function readAssetFile(
  path: string,
): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  const db = await admin();
  const { data, error } = await db.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return { bytes: await data.arrayBuffer(), mime: data.type || "application/octet-stream" };
}

/* ------------------------------ card assignments ------------------------------ */

export type CardAssetLink = {
  variantKey: string;
  cardImage: { id: string; url: string; width: number | null; height: number | null } | null;
  /** Explicit per-card background override. Card type mappings never touch it. */
  background: {
    id: string;
    url: string;
    safeArea: SafeArea | null;
    protectedAreas: ProtectedArea[];
  } | null;
  backgroundManual: boolean;
  composition: CompositionOverride | null;
};

type LinkRow = {
  variant_key: string;
  card_image_asset_id: string | null;
  background_asset_id: string | null;
};

type AssetArtRow = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  safe_area: unknown;
  protected_areas: unknown;
};

const ART_SELECT = "id, url, width, height, safe_area, protected_areas";

export function toImageArt(row: AssetArtRow | undefined) {
  return row ? { id: row.id, url: row.url, width: row.width, height: row.height } : null;
}

export function toBackgroundArt(row: AssetArtRow | undefined) {
  return row
    ? {
        id: row.id,
        url: row.url,
        safeArea: row.safe_area ? normalizeSafeArea(row.safe_area) : null,
        protectedAreas: normalizeProtectedAreas(row.protected_areas),
      }
    : null;
}

export async function listCardAssetLinks(): Promise<CardAssetLink[]> {
  const db = await admin();
  const [links, assets] = await Promise.all([
    db
      .from("card_asset_links")
      .select(
        "variant_key, card_image_asset_id, background_asset_id, background_manual, composition",
      ),
    db.from("assets").select(ART_SELECT),
  ]);
  if (links.error) throw links.error;
  if (assets.error) throw assets.error;
  const byId = new Map((assets.data as AssetArtRow[]).map((a) => [a.id, a]));
  const rows = links.data as (LinkRow & {
    background_manual: boolean;
    composition: unknown;
  })[];
  return rows.map((row) => ({
    variantKey: row.variant_key,
    cardImage: toImageArt(byId.get(row.card_image_asset_id ?? "")),
    background: row.background_manual
      ? toBackgroundArt(byId.get(row.background_asset_id ?? ""))
      : null,
    backgroundManual: Boolean(row.background_manual && row.background_asset_id),
    composition: normalizeOverride(row.composition),
  }));
}

/** Composition geometry lives on the background asset and is reused by every card. */
export async function saveBackgroundGeometry(
  assetId: string,
  safeArea: SafeArea,
  protectedAreas: ProtectedArea[],
) {
  const db = await admin();
  await assertAssetType(assetId, "CARD_BACKGROUND");
  const { error } = await db
    .from("assets")
    .update({
      safe_area: safeArea,
      protected_areas: protectedAreas,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId);
  if (error) throw error;
}

/** Per-card manual composition override. Survives every synchronization. */
export async function saveCardComposition(
  variantKeyValue: string,
  override: CompositionOverride | null,
) {
  const db = await admin();
  const { data: existing } = await db
    .from("card_asset_links")
    .select("variant_key, card_image_asset_id, background_asset_id, background_manual")
    .eq("variant_key", variantKeyValue)
    .maybeSingle();
  const { error } = await db.from("card_asset_links").upsert(
    {
      variant_key: variantKeyValue,
      card_image_asset_id: existing?.card_image_asset_id ?? null,
      background_asset_id: existing?.background_asset_id ?? null,
      background_manual: existing?.background_manual ?? false,
      composition: override,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "variant_key" },
  );
  if (error) throw error;
}

async function assertAssetType(assetId: string, expected: string) {
  const db = await admin();
  const { data, error } = await db
    .from("assets")
    .select("asset_type")
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("That asset no longer exists.");
  if (data.asset_type !== expected) {
    throw new Error(
      `Only assets of type ${expected} can be used here. This asset is ${data.asset_type}.`,
    );
  }
}

/** Assigns PLAYER_CARD assets as card images. Existing images are protected unless replace is set. */
export async function assignCardImages(
  entries: { variantKey: string; assetId: string }[],
  options: { replaceExisting: boolean },
): Promise<{ assigned: number; skipped: number }> {
  if (entries.length === 0) return { assigned: 0, skipped: 0 };
  const db = await admin();
  const uniqueAssets = [...new Set(entries.map((e) => e.assetId))];
  for (const assetId of uniqueAssets) await assertAssetType(assetId, "PLAYER_CARD");

  const keys = entries.map((e) => e.variantKey);
  const { data: existing, error } = await db
    .from("card_asset_links")
    .select("variant_key, card_image_asset_id, background_asset_id")
    .in("variant_key", keys);
  if (error) throw error;
  const existingMap = new Map((existing as LinkRow[]).map((r) => [r.variant_key, r]));

  const rows: LinkRow[] = [];
  let skipped = 0;
  for (const entry of entries) {
    const current = existingMap.get(entry.variantKey);
    if (current?.card_image_asset_id && !options.replaceExisting) {
      skipped += 1;
      continue;
    }
    rows.push({
      variant_key: entry.variantKey,
      card_image_asset_id: entry.assetId,
      background_asset_id: current?.background_asset_id ?? null,
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const { error: upsertError } = await db
      .from("card_asset_links")
      .upsert(
        rows.slice(i, i + 500).map((r) => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: "variant_key" },
      );
    if (upsertError) throw upsertError;
  }
  return { assigned: rows.length, skipped };
}

export async function clearCardImages(variantKeys: string[]): Promise<number> {
  if (variantKeys.length === 0) return 0;
  const db = await admin();
  const { error } = await db
    .from("card_asset_links")
    .update({ card_image_asset_id: null, updated_at: new Date().toISOString() })
    .in("variant_key", variantKeys);
  if (error) throw error;
  return variantKeys.length;
}

/** Applies (or with assetId null removes) a CARD_BACKGROUND across many cards at once. */
export async function applyBackground(
  variantKeys: string[],
  assetId: string | null,
): Promise<number> {
  if (variantKeys.length === 0) return 0;
  const db = await admin();
  if (assetId) await assertAssetType(assetId, "CARD_BACKGROUND");

  const { data: existing, error } = await db
    .from("card_asset_links")
    .select("variant_key, card_image_asset_id, background_asset_id")
    .in("variant_key", variantKeys);
  if (error) throw error;
  const existingMap = new Map((existing as LinkRow[]).map((r) => [r.variant_key, r]));

  const rows = variantKeys.map((key) => ({
    variant_key: key,
    card_image_asset_id: existingMap.get(key)?.card_image_asset_id ?? null,
    background_asset_id: assetId,
    // An explicit per-card choice always outranks the CARD TYPE rule.
    background_manual: assetId !== null,
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error: upsertError } = await db
      .from("card_asset_links")
      .upsert(rows.slice(i, i + 500), { onConflict: "variant_key" });
    if (upsertError) throw upsertError;
  }
  return rows.length;
}

/* ------------------------------ Google Drive ------------------------------ */

/**
 * Creates or updates the asset backing one Google Drive file.
 * The Drive file ID is the stable identity: a renamed file keeps its asset, a
 * modified file replaces the stored bytes instead of creating a duplicate.
 */
export async function upsertDriveAsset(input: {
  driveFileId: string;
  name: string;
  folder: string;
  type: string;
  bytes: Uint8Array;
  declaredMime: string;
  driveModifiedAt: string | null;
}): Promise<{ asset: AssetRecord; created: boolean }> {
  if (input.bytes.byteLength > MAX_ASSET_BYTES) throw new Error("The file is larger than 15 MB.");
  const probe = probeImage(input.bytes, input.declaredMime);
  const db = await admin();

  const { data: existing, error: readError } = await db
    .from("assets")
    .select(SELECT)
    .eq("drive_file_id", input.driveFileId)
    .maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const row = existing as AssetRow;
    if (row.storage_path) await db.storage.from(BUCKET).remove([row.storage_path]);
    const path = await storeBytes(input.bytes, input.name, probe.mime, row.id);
    const { data, error } = await db
      .from("assets")
      .update({
        name: input.name,
        asset_type: input.type,
        source: "drive",
        url: publicPath(path),
        storage_path: path,
        mime_type: probe.mime,
        file_size: input.bytes.byteLength,
        width: probe.width,
        height: probe.height,
        drive_folder: input.folder,
        drive_modified_at: input.driveModifiedAt,
        import_status: "UPDATED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .select(SELECT)
      .single();
    if (error) throw error;
    return { asset: toRecord(data as AssetRow), created: false };
  }

  const id = crypto.randomUUID();
  const path = await storeBytes(input.bytes, input.name, probe.mime, id);
  const { data, error } = await db
    .from("assets")
    .insert({
      id,
      name: input.name,
      asset_type: input.type,
      source: "drive",
      url: publicPath(path),
      storage_path: path,
      mime_type: probe.mime,
      file_size: input.bytes.byteLength,
      width: probe.width,
      height: probe.height,
      drive_file_id: input.driveFileId,
      drive_folder: input.folder,
      drive_modified_at: input.driveModifiedAt,
      import_status: "IMPORTED",
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return { asset: toRecord(data as AssetRow), created: true };
}
