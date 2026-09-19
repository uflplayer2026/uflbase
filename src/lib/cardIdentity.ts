import type { PlayerCardRecord } from "./playerTypes";

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Stable card *variant* identity.
 * A variant is a meaningfully different card of a player: the same player with a
 * different rating, position or perk is a DIFFERENT card, never an update of the
 * previous one. Card Image is deliberately excluded — it is manually managed and
 * must never define identity.
 */
export function variantKey(p: PlayerCardRecord): string {
  return [norm(p.playerName), norm(p.position), p.ovr === null ? "" : p.ovr, norm(p.perk)].join(
    "|",
  );
}

/** Fields that count as a record update within one variant. */
export const TRACKED_FIELDS = [
  "nation",
  "pac",
  "sho",
  "pas",
  "dri",
  "def",
  "phy",
  "cardImage",
] as const;

export type TrackedField = (typeof TRACKED_FIELDS)[number];

export function fingerprint(p: PlayerCardRecord): string {
  return TRACKED_FIELDS.map((f) => {
    const v = p[f];
    return v === null ? "" : typeof v === "string" ? norm(v) : String(v);
  }).join("|");
}

/** A row with no meaningful content is not a record at all. */
export function isRealRecord(p: PlayerCardRecord): boolean {
  return norm(p.playerName) !== "" || p.ovr !== null;
}
