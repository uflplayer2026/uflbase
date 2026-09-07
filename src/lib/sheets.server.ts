import type { PlayerCardRecord, PlayersSnapshot } from "./playerTypes";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";
const ROW_ID = "players";

export type SyncOutcome = {
  status: "success" | "failed" | "skipped";
  message: string;
  durationMs: number;
  cardCount: number | null;
};

function config() {
  return {
    lovableKey: process.env["LOVABLE_API_KEY"] ?? "",
    connectionKey: process.env["GOOGLE_SHEETS_API_KEY"] ?? "",
    spreadsheetId: process.env["GOOGLE_SHEETS_SPREADSHEET_ID"] ?? "",
    sheetName: process.env["GOOGLE_SHEETS_SHEET_NAME"] || "Sheet1",
    intervalMinutes: Math.max(1, Number(process.env["SYNC_INTERVAL_MINUTES"] ?? 15) || 15),
  };
}

export function sheetsConfigStatus() {
  const c = config();
  return {
    connectorLinked: Boolean(c.lovableKey && c.connectionKey),
    spreadsheetConfigured: Boolean(c.spreadsheetId),
    sheetName: c.sheetName,
    intervalMinutes: c.intervalMinutes,
  };
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const text = (row: string[], i: number) => (row[i] ?? "").toString().trim();

const num = (row: string[], i: number) => {
  const raw = text(row, i);
  if (raw === "") return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

/** Fetches the raw sheet rows and maps them onto the fixed 12-column model. */
export async function fetchSheetPlayers(): Promise<PlayerCardRecord[]> {
  const c = config();
  if (!c.lovableKey || !c.connectionKey) {
    throw new Error("Google Sheets connection is not configured.");
  }
  if (!c.spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured.");
  }

  const range = `${c.sheetName}!A2:L`;
  const res = await fetch(
    `${GATEWAY_URL}/spreadsheets/${c.spreadsheetId}/values/${range}?majorDimension=ROWS`,
    {
      headers: {
        Authorization: `Bearer ${c.lovableKey}`,
        "X-Connection-Api-Key": c.connectionKey,
      },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Sheets read failed [${res.status}]: ${body}`);
    throw new Error(`Google Sheets returned error ${res.status}.`);
  }

  const json = (await res.json()) as { values?: string[][] };
  const rows = json.values ?? [];

  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.some((cell) => (cell ?? "").toString().trim() !== ""))
    .map(({ row, index }) => ({
      // Row number keeps identity stable and idempotent across repeated syncs.
      id: `r${index + 2}`,
      playerName: text(row, 0),
      ovr: num(row, 1),
      position: text(row, 2),
      nation: text(row, 3),
      pac: num(row, 4),
      sho: num(row, 5),
      pas: num(row, 6),
      dri: num(row, 7),
      def: num(row, 8),
      phy: num(row, 9),
      perk: text(row, 10),
      cardImage: text(row, 11),
    }))
    .filter((p) => p.playerName !== "" || p.ovr !== null);
}

/**
 * Replaces the cached dataset with the current sheet contents.
 * Single-flight: a DB-level lock prevents overlapping syncs.
 * On failure the previous good dataset is left untouched.
 */
export async function runSync(trigger: "auto" | "manual" | "initial"): Promise<SyncOutcome> {
  const db = await admin();
  const started = Date.now();

  const { data: locked, error: lockError } = await db.rpc("acquire_sync_lock", {
    _stale_seconds: 300,
  });
  if (lockError) throw lockError;
  if (!locked) {
    return {
      status: "skipped",
      message: "A synchronization is already running.",
      durationMs: 0,
      cardCount: null,
    };
  }

  try {
    const players = await fetchSheetPlayers();
    const durationMs = Date.now() - started;
    await db
      .from("sheet_sync_state")
      .update({
        players,
        card_count: players.length,
        last_success_at: new Date().toISOString(),
        last_duration_ms: durationMs,
        last_status: "success",
        last_error: null,
        sync_running: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ROW_ID);

    return {
      status: "success",
      message: `Synced ${players.length} cards (${trigger}).`,
      durationMs,
      cardCount: players.length,
    };
  } catch (err) {
    const durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : "Unknown sync error";
    // Keep the previous dataset — only the status fields change.
    await db
      .from("sheet_sync_state")
      .update({
        last_duration_ms: durationMs,
        last_status: "failed",
        last_error: message,
        sync_running: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ROW_ID);

    return { status: "failed", message, durationMs, cardCount: null };
  }
}

type StateRow = {
  players: PlayerCardRecord[];
  card_count: number;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_duration_ms: number | null;
  last_status: string | null;
  last_error: string | null;
  sync_running: boolean;
};

async function readState(): Promise<StateRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("sheet_sync_state")
    .select(
      "players, card_count, last_success_at, last_attempt_at, last_duration_ms, last_status, last_error, sync_running",
    )
    .eq("id", ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return (data as StateRow | null) ?? null;
}

function toSnapshot(state: StateRow | null, intervalMinutes: number): PlayersSnapshot {
  const lastSuccessAt = state?.last_success_at ?? null;
  return {
    players: state?.players ?? [],
    cardCount: state?.card_count ?? 0,
    lastSuccessAt,
    lastAttemptAt: state?.last_attempt_at ?? null,
    lastDurationMs: state?.last_duration_ms ?? null,
    lastStatus: state?.last_status ?? null,
    lastError: state?.last_error ?? null,
    syncing: state?.sync_running ?? false,
    nextSyncAt: lastSuccessAt
      ? new Date(new Date(lastSuccessAt).getTime() + intervalMinutes * 60_000).toISOString()
      : null,
    intervalMinutes,
  };
}

/** Reads the cached dataset; syncs first when there is nothing cached or the cache is stale. */
export async function getSnapshot(): Promise<PlayersSnapshot> {
  const { intervalMinutes } = config();
  let state = await readState();

  const isEmpty = !state || !state.last_success_at || (state.players?.length ?? 0) === 0;
  const isStale =
    !!state?.last_success_at &&
    Date.now() - new Date(state.last_success_at).getTime() > intervalMinutes * 60_000;

  if (isEmpty || isStale) {
    await runSync(isEmpty ? "initial" : "auto");
    state = await readState();
  }

  const snapshot = toSnapshot(state, intervalMinutes);
  if (snapshot.players.length === 0 && snapshot.lastStatus === "failed") {
    throw new Error("Unable to load player cards. Please try again.");
  }
  return snapshot;
}

export async function getSnapshotWithoutSync(): Promise<PlayersSnapshot> {
  const { intervalMinutes } = config();
  return toSnapshot(await readState(), intervalMinutes);
}
