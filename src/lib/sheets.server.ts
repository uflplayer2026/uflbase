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

export type SheetsFailureKind =
  | "auth"
  | "permission"
  | "not_found"
  | "bad_request"
  | "rate_limit"
  | "config"
  | "provider"
  | "unknown";

export class SheetsError extends Error {
  kind: SheetsFailureKind;
  constructor(kind: SheetsFailureKind, message: string) {
    super(message);
    this.name = "SheetsError";
    this.kind = kind;
  }
}

/** Turns a raw Google/gateway failure into a specific, actionable operator message. */
function classifyFailure(status: number, body: string): SheetsError {
  const lower = body.toLowerCase();

  if (status === 401) {
    if (lower.includes("lovable_api_key") || lower.includes("not_registered")) {
      return new SheetsError(
        "config",
        "The internal service key was rejected. The Google Sheets connection needs to be re-linked to this project.",
      );
    }
    return new SheetsError(
      "auth",
      "Google Sheets authentication expired. Reconnect Google to continue synchronization.",
    );
  }
  if (status === 403) {
    if (lower.includes("insufficient") || lower.includes("scope")) {
      return new SheetsError(
        "permission",
        "The Google connection is missing spreadsheet read permission. Reconnect Google and allow spreadsheet access.",
      );
    }
    if (lower.includes("has not been used") || lower.includes("is disabled")) {
      return new SheetsError(
        "permission",
        "The Google Sheets API is not enabled for the authorized Google project.",
      );
    }
    return new SheetsError(
      "permission",
      "Access to this spreadsheet was denied. The connected Google account must have at least view access.",
    );
  }
  if (status === 404) {
    return new SheetsError(
      "not_found",
      "Spreadsheet not found. Check the configured spreadsheet ID.",
    );
  }
  if (status === 400) {
    return new SheetsError(
      "bad_request",
      lower.includes("unable to parse range")
        ? "The configured sheet tab name is invalid or the tab was renamed."
        : "Google rejected the request as invalid. Check the sheet tab name and range.",
    );
  }
  if (status === 429) {
    return new SheetsError("rate_limit", "Google Sheets rate limit reached. Try again shortly.");
  }
  if (status >= 500) {
    return new SheetsError("provider", `Google Sheets is temporarily unavailable (${status}).`);
  }
  return new SheetsError("unknown", `Google Sheets returned an unexpected error (${status}).`);
}

/** Fetches the raw sheet rows and maps them onto the fixed 12-column model. */
export async function fetchSheetPlayers(): Promise<PlayerCardRecord[]> {
  const c = config();
  if (!c.lovableKey || !c.connectionKey) {
    throw new SheetsError(
      "config",
      "The Google Sheets connection is not linked to this project. Connect Google Sheets first.",
    );
  }
  if (!c.spreadsheetId) {
    throw new SheetsError("config", "No spreadsheet ID is configured for synchronization.");
  }

  const range = `${c.sheetName}!A2:L`;
  console.log(`[sheets] read started (tab=${c.sheetName}, credentials=available)`);

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
    const failure = classifyFailure(res.status, body);
    // Never log credentials — status, classification and Google's own message only.
    console.error(`[sheets] read failed status=${res.status} kind=${failure.kind}: ${body}`);
    throw failure;
  }

  const json = (await res.json()) as { values?: string[][] };
  const rows = json.values ?? [];
  console.log(`[sheets] read ok rows=${rows.length}`);

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
