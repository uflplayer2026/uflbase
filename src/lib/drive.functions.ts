import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DRIVE_IMPORT_MODES,
  IMPORT_STATUSES,
  ASSET_TYPES,
  type DriveAssetRecord,
  type DriveSyncStatus,
} from "./assetTypes";

async function guard(claims: unknown) {
  const { assertAdmin } = await import("./adminAuth.server");
  return assertAdmin(claims);
}

export const getDriveSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriveSyncStatus> => {
    await guard(context.claims);
    const { getDriveStatus } = await import("./drive.server");
    return getDriveStatus();
  });

export const listDriveFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z.enum(IMPORT_STATUSES).optional(),
        type: z.enum(ASSET_TYPES).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<DriveAssetRecord[]> => {
    await guard(context.claims);
    const { listDriveAssets } = await import("./drive.server");
    return listDriveAssets({ status: data.status, type: data.type });
  });

export const runDriveSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.claims);
    const { syncDrive } = await import("./drive.server");
    return syncDrive("manual");
  });

export const setDriveImportMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ mode: z.enum(DRIVE_IMPORT_MODES) }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await guard(context.claims);
    const { setImportMode } = await import("./drive.server");
    await setImportMode(data.mode);
    return { ok: true };
  });

export const importDriveAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        driveFileId: z.string().min(4),
        apply: z.boolean().default(false),
        replaceExisting: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<DriveAssetRecord> => {
    await guard(context.claims);
    const { importDriveFile } = await import("./drive.server");
    return importDriveFile(data.driveFileId, {
      apply: data.apply,
      replaceExisting: data.replaceExisting,
    });
  });

export const setDriveAssetStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ driveFileId: z.string().min(4), status: z.enum(IMPORT_STATUSES) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await guard(context.claims);
    const { setDriveStatus } = await import("./drive.server");
    await setDriveStatus(data.driveFileId, data.status);
    return { ok: true };
  });

export const setDriveAutoSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ enabled: z.boolean() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await guard(context.claims);
    const { setAutoSync } = await import("./drive.server");
    await setAutoSync(data.enabled);
    return { ok: true };
  });
