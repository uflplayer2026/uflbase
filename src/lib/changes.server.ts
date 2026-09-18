import type { PlayerCardRecord } from "./playerTypes";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { CardChange, ChangeView } from "./changes.functions";
import { fingerprint, isRealRecord, variantKey, TRACKED_FIELDS } from "./cardIdentity";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type RegistryRow = {
  variant_key: string;
  row_id: string;
  player_name: string;
  position: string;
  nation: string;
  ovr: number | null;
  pac: number | null;
  sho: number | null;
  pas: number | null;
  dri: number | null;
  def: number | null;
  phy: number | null;
  perk: string;
  card_image: string;
  changed_fields: unknown;
  first_seen_at: string;
  last_changed_at: string | null;
};

function toRecord(row: RegistryRow): PlayerCardRecord {
  return {
    id: row.row_id,
    playerName: row.player_name,
    ovr: row.ovr,
    position: row.position,
    nation: row.nation,
    pac: row.pac,
    sho: row.sho,
    pas: row.pas,
    dri: row.dri,
    def: row.def,
    phy: row.phy,
    perk: row.perk,
    cardImage: row.card_image,
    // Drive Link is snapshot-only data, never part of identity or change history.
    driveLink: "",
  };
}

const SELECT =
  "variant_key, row_id, player_name, position, nation, ovr, pac, sho, pas, dri, def, phy, perk, card_image, changed_fields, first_seen_at, last_changed_at";

export async function listChanges(
  view: ChangeView,
  hours: number,
  limit: number,
): Promise<CardChange[]> {
  const db = await admin();
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();

  let query = db.from("card_registry").select(SELECT).limit(limit);

  if (view === "added") {
    query = query.gte("first_seen_at", cutoff).order("first_seen_at", { ascending: false });
  } else if (view === "updated") {
    query = query
      .not("last_changed_at", "is", null)
      .gte("last_changed_at", cutoff)
      .order("last_changed_at", { ascending: false });
  } else {
    query = query
      .eq("is_new_variant", true)
      .gte("first_seen_at", cutoff)
      .order("first_seen_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as RegistryRow[]).map((row) => ({
    player: toRecord(row),
    at: view === "updated" ? row.last_changed_at : row.first_seen_at,
    changedFields: Array.isArray(row.changed_fields) ? (row.changed_fields as string[]) : [],
  }));
}

type KnownRow = { variant_key: string; fingerprint: string; player_name: string };

async function readKnown(): Promise<KnownRow[]> {
  const db = await admin();
  const page = 1000;
  const all: KnownRow[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await db
      .from("card_registry")
      .select("variant_key, fingerprint, player_name")
      .range(from, from + page - 1);
    if (error) throw error;
    const rows = (data ?? []) as KnownRow[];
    all.push(...rows);
    if (rows.length < page) break;
  }
  return all;
}

const norm = (v: string) => v.trim().toLowerCase();

/**
 * Incremental reconciliation: only genuinely new or genuinely changed records are
 * written, so a repeated sync of unchanged data performs no writes at all.
 * Empty / whitespace-only sheet rows never become records.
 */
export async function reconcileRegistry(players: PlayerCardRecord[]): Promise<number> {
  const db = await admin();
  const known = await readKnown();
  const byKey = new Map(known.map((r) => [r.variant_key, r]));
  const knownNames = new Set(known.map((r) => norm(r.player_name)));

  const now = new Date().toISOString();
  const inserts: TablesInsert<"card_registry">[] = [];
  const seen = new Set<string>();

  for (const p of players) {
    if (!isRealRecord(p)) continue;
    const key = variantKey(p);
    if (seen.has(key)) continue;
    seen.add(key);

    const fp = fingerprint(p);
    const existing = byKey.get(key);
    if (existing && existing.fingerprint === fp) continue;

    const changedFields: string[] = [];
    if (existing) {
      // Field-level diff is derivable from the fingerprint segments.
      const before = existing.fingerprint.split("|");
      const after = fp.split("|");
      TRACKED_FIELDS.forEach((field, i) => {
        if (before[i] !== after[i]) changedFields.push(field);
      });
    }

    inserts.push({
      variant_key: key,
      row_id: p.id,
      player_name: p.playerName,
      position: p.position,
      nation: p.nation,
      ovr: p.ovr,
      pac: p.pac,
      sho: p.sho,
      pas: p.pas,
      dri: p.dri,
      def: p.def,
      phy: p.phy,
      perk: p.perk,
      card_image: p.cardImage,
      fingerprint: fp,
      changed_fields: changedFields,
      last_seen_at: now,
      ...(existing
        ? { last_changed_at: now }
        : {
            first_seen_at: now,
            last_changed_at: null,
            // A brand-new card of an already known player is a new variant.
            is_new_variant: knownNames.has(norm(p.playerName)),
          }),
    });
  }

  for (let i = 0; i < inserts.length; i += 500) {
    const { error } = await db
      .from("card_registry")
      .upsert(inserts.slice(i, i + 500), { onConflict: "variant_key" });
    if (error) throw error;
  }

  return inserts.length;
}
