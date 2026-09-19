import { toBackgroundArt } from "./assets.server";
import type { ProtectedArea, SafeArea } from "./cardComposition";
import type { PlayerCardRecord } from "./playerTypes";
import { isRealRecord } from "./cardIdentity";

/**
 * CARD TYPE (sheet column N) is used for exactly one thing: the reusable
 * "CARD TYPE -> CARD BACKGROUND" rule. It never takes part in card identity,
 * duplicate detection, variant detection or image matching.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type CardTypeBackground = {
  cardType: string;
  background: {
    id: string;
    url: string;
    safeArea: SafeArea | null;
    protectedAreas: ProtectedArea[];
  } | null;
};

export type CardTypeEntry = CardTypeBackground & {
  cardCount: number;
  firstSeenAt: string;
  /** true once an administrator has saved a rule (a deliberate "none" counts too). */
  mapped: boolean;
};

/** Every sync records the card types present in the sheet, so new ones can be surfaced. */
export async function registerCardTypes(players: PlayerCardRecord[]): Promise<number> {
  const counts = new Map<string, number>();
  for (const p of players) {
    if (!isRealRecord(p)) continue;
    const type = (p.cardType ?? "").trim();
    if (!type) continue;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  if (counts.size === 0) return 0;
  const db = await admin();
  const now = new Date().toISOString();
  const { error } = await db.from("card_type_registry").upsert(
    [...counts].map(([card_type, card_count]) => ({ card_type, card_count, last_seen_at: now })),
    { onConflict: "card_type" },
  );
  if (error) throw error;
  return counts.size;
}

async function mappingRows() {
  const db = await admin();
  const [mappings, assets] = await Promise.all([
    db.from("card_type_backgrounds").select("card_type, background_asset_id"),
    db.from("assets").select("id, url, width, height, safe_area, protected_areas"),
  ]);
  if (mappings.error) throw mappings.error;
  if (assets.error) throw assets.error;
  const byId = new Map((assets.data ?? []).map((a) => [a.id, a]));
  return { mappings: mappings.data ?? [], byId };
}

/** Public read used when rendering cards: card type -> inherited background. */
export async function listCardTypeBackgrounds(): Promise<CardTypeBackground[]> {
  const { mappings, byId } = await mappingRows();
  return mappings.map((m) => ({
    cardType: m.card_type,
    background: toBackgroundArt(
      byId.get(m.background_asset_id ?? "") as Parameters<typeof toBackgroundArt>[0],
    ),
  }));
}

/** Admin view: every observed card type with its rule state. */
export async function listCardTypes(): Promise<CardTypeEntry[]> {
  const db = await admin();
  const [registry, { mappings, byId }] = await Promise.all([
    db.from("card_type_registry").select("card_type, card_count, first_seen_at"),
    mappingRows(),
  ]);
  if (registry.error) throw registry.error;
  const mapped = new Map(mappings.map((m) => [m.card_type, m.background_asset_id]));
  return (registry.data ?? [])
    .map((row) => ({
      cardType: row.card_type,
      cardCount: row.card_count,
      firstSeenAt: row.first_seen_at,
      mapped: mapped.has(row.card_type),
      background: toBackgroundArt(
        byId.get(mapped.get(row.card_type) ?? "") as Parameters<typeof toBackgroundArt>[0],
      ),
    }))
    .sort((a, b) => {
      if (a.mapped !== b.mapped) return a.mapped ? 1 : -1;
      return b.cardCount - a.cardCount;
    });
}

export async function saveCardTypeBackground(cardType: string, assetId: string | null) {
  const db = await admin();
  if (assetId) {
    const { data, error } = await db
      .from("assets")
      .select("asset_type")
      .eq("id", assetId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("That background no longer exists.");
    if (data.asset_type !== "CARD_BACKGROUND") {
      throw new Error("Only card background assets can be mapped to a card type.");
    }
  }
  const { error } = await db.from("card_type_backgrounds").upsert(
    {
      card_type: cardType,
      background_asset_id: assetId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "card_type" },
  );
  if (error) throw error;
}

export async function deleteCardTypeBackground(cardType: string) {
  const db = await admin();
  const { error } = await db.from("card_type_backgrounds").delete().eq("card_type", cardType);
  if (error) throw error;
}
