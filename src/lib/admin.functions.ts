import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlayersSnapshot } from "./playerTypes";

export type AdminOverview = {
  adminEmail: string;
  sheets: {
    connectorLinked: boolean;
    spreadsheetConfigured: boolean;
    sheetName: string;
    intervalMinutes: number;
  };
  sync: PlayersSnapshot;
};

export type SyncResult = {
  status: "success" | "failed" | "skipped";
  message: string;
  durationMs: number;
  cardCount: number | null;
  changeCount?: number;
  kind?: string;
};

function emailFromClaims(claims: unknown): string {
  const c = claims as { email?: string; user_metadata?: { email?: string } } | null;
  return (c?.email ?? c?.user_metadata?.email ?? "").toLowerCase().trim();
}

/** Server-side authorization: the verified token email must match GOOGLE_ADMIN_EMAIL. */
function assertAdmin(claims: unknown): string {
  const configured = (process.env["GOOGLE_ADMIN_EMAIL"] ?? "").toLowerCase().trim();
  const email = emailFromClaims(claims);
  if (!configured) throw new Error("Admin access is not configured.");
  if (!email || email !== configured) throw new Error("Not authorized.");
  return email;
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const adminEmail = assertAdmin(context.claims);
    const { sheetsConfigStatus, getSnapshotWithoutSync } = await import("./sheets.server");
    return {
      adminEmail,
      sheets: sheetsConfigStatus(),
      sync: await getSnapshotWithoutSync(),
    };
  });

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean; email: string }> => {
    const configured = (process.env["GOOGLE_ADMIN_EMAIL"] ?? "").toLowerCase().trim();
    const email = emailFromClaims(context.claims);
    return { isAdmin: Boolean(configured) && email === configured, email };
  });

export const runManualSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncResult> => {
    assertAdmin(context.claims);
    const { runSync } = await import("./sheets.server");
    return runSync("manual");
  });

export const testSheetsConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; message: string; rows: number }> => {
    assertAdmin(context.claims);
    const { fetchSheetPlayers } = await import("./sheets.server");
    try {
      const players = await fetchSheetPlayers();
      return { ok: true, message: `Connection OK — ${players.length} rows readable.`, rows: players.length };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Connection failed.",
        rows: 0,
      };
    }
  });
