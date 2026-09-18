import { MAX_ASSET_BYTES, isHttpUrl, type AssetRecord, type AssetSource } from "./assetTypes";
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
};

const SELECT =
  "id, name, asset_type, source, url, storage_path, mime_type, file_size, width, height, created_at";

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
  type?: string;
  q?: string;
  limit?: number;
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
  name?: string;
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
  const patch: Record<string, unknown> = { name, updated_at: new Date().toISOString() };
  if (type) patch["asset_type"] = type;
  const { error } = await db.from("assets").update(patch).eq("id", id);
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
  cardImage: { id: string; url: string } | null;
  background: { id: string; url: string } | null;
};

type LinkRow = {
  variant_key: string;
  card_image_asset_id: string | null;
  background_asset_id: string | null;
};

export async function listCardAssetLinks(): Promise<CardAssetLink[]> {
  const db = await admin();
  const [links, assets] = await Promise.all([
    db.from("card_asset_links").select("variant_key, card_image_asset_id, background_asset_id"),
    db.from("assets").select("id, url"),
  ]);
  if (links.error) throw links.error;
  if (assets.error) throw assets.error;
  const byId = new Map((assets.data ?? []).map((a) => [a.id, a.url]));
  const resolve = (id: string | null) => {
    if (!id) return null;
    const url = byId.get(id);
    return url ? { id, url } : null;
  };
  return (links.data as LinkRow[]).map((row) => ({
    variantKey: row.variant_key,
    cardImage: resolve(row.card_image_asset_id),
    background: resolve(row.background_asset_id),
  }));
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
