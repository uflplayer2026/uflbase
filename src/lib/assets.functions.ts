import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ASSET_TYPES, type AssetRecord } from "./assetTypes";
import type { CardAssetLink } from "./assets.server";

export type { CardAssetLink } from "./assets.server";

const assetTypeSchema = z.enum(ASSET_TYPES);

async function guard(claims: unknown) {
  const { assertAdmin } = await import("./adminAuth.server");
  return assertAdmin(claims);
}

/** Public read: every visitor needs the card image / background assignments. */
export const getCardAssets = createServerFn({ method: "GET" }).handler(
  async (): Promise<CardAssetLink[]> => {
    const { listCardAssetLinks } = await import("./assets.server");
    return listCardAssetLinks();
  },
);

export const getAssetLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ type: assetTypeSchema.optional(), q: z.string().max(120).optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<AssetRecord[]> => {
    await guard(context.claims);
    const { listAssets } = await import("./assets.server");
    return listAssets({ type: data.type, q: data.q });
  });

export const uploadAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().min(1).max(200),
        type: assetTypeSchema,
        base64: z.string().min(16),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<AssetRecord> => {
    await guard(context.claims);
    const { createUploadedAsset } = await import("./assets.server");
    return createUploadedAsset(data);
  });

export const addUrlAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().max(200).optional(),
        type: assetTypeSchema,
        url: z.string().min(8).max(2000),
        mode: z.enum(["external", "import"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<AssetRecord> => {
    await guard(context.claims);
    const { createUrlAsset } = await import("./assets.server");
    return createUrlAsset(data);
  });

export const updateAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200),
        type: assetTypeSchema.optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await guard(context.claims);
    const { renameAsset } = await import("./assets.server");
    await renameAsset(data.id, data.name, data.type);
    return { ok: true };
  });

export const replaceAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), base64: z.string().min(16) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<AssetRecord> => {
    await guard(context.claims);
    const { replaceAssetFile } = await import("./assets.server");
    return replaceAssetFile(data.id, data.base64);
  });

export const removeAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await guard(context.claims);
    const { deleteAsset } = await import("./assets.server");
    await deleteAsset(data.id);
    return { ok: true };
  });

export const assignCardImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        entries: z
          .array(z.object({ variantKey: z.string().min(1), assetId: z.string().uuid() }))
          .min(1)
          .max(1000),
        replaceExisting: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ assigned: number; skipped: number }> => {
    await guard(context.claims);
    const { assignCardImages: assign } = await import("./assets.server");
    return assign(data.entries, { replaceExisting: data.replaceExisting });
  });

export const clearCardImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ variantKeys: z.array(z.string().min(1)).min(1).max(20000) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ cleared: number }> => {
    await guard(context.claims);
    const { clearCardImages: clear } = await import("./assets.server");
    return { cleared: await clear(data.variantKeys) };
  });

export const applyCardBackground = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        variantKeys: z.array(z.string().min(1)).min(1).max(20000),
        assetId: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ applied: number }> => {
    await guard(context.claims);
    const { applyBackground } = await import("./assets.server");
    return { applied: await applyBackground(data.variantKeys, data.assetId) };
  });

/** Composition geometry for a background: reusable safe area + protected areas. */
export const saveBackgroundAreas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        assetId: z.string().uuid(),
        safeArea: z.object({
          top: z.number().min(0).max(100),
          right: z.number().min(0).max(100),
          bottom: z.number().min(0).max(100),
          left: z.number().min(0).max(100),
          maxWidth: z.number().min(1).max(100),
          maxHeight: z.number().min(1).max(100),
          alignX: z.enum(["start", "center", "end"]),
          alignY: z.enum(["start", "center", "end"]),
        }),
        protectedAreas: z
          .array(
            z.object({
              label: z.string().max(80),
              top: z.number().min(0).max(100),
              right: z.number().min(0).max(100),
              bottom: z.number().min(0).max(100),
              left: z.number().min(0).max(100),
            }),
          )
          .max(20),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await guard(context.claims);
    const { saveBackgroundGeometry } = await import("./assets.server");
    await saveBackgroundGeometry(data.assetId, data.safeArea, data.protectedAreas);
    return { ok: true };
  });

/** Per-card manual composition override; automatic composition is the default. */
export const saveCardCompositionOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        variantKey: z.string().min(1),
        override: z
          .object({
            scale: z.number().min(0.4).max(1.4),
            x: z.number().min(-40).max(40),
            y: z.number().min(-40).max(40),
          })
          .nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await guard(context.claims);
    const { saveCardComposition } = await import("./assets.server");
    await saveCardComposition(data.variantKey, data.override);
    return { ok: true };
  });
