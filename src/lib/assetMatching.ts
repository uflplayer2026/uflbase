import type { PlayerCardRecord } from "./playerTypes";

/** Client-safe matching of uploaded image names to existing cards. Never guesses. */

export type MatchGroup = "matched" | "review" | "unmatched";

export type MatchCandidate = { player: PlayerCardRecord; reason: string };

export type MatchResult = {
  fileName: string;
  group: MatchGroup;
  candidates: MatchCandidate[];
};

const norm = (v: string) =>
  v
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const compact = (v: string) => norm(v).replace(/\s/g, "");

/**
 * Resolution order: stable card id, then name (+ OVR / position when the name repeats).
 * Anything with more than one plausible card is sent to review rather than assigned.
 */
export function matchFileName(fileName: string, players: PlayerCardRecord[]): MatchResult {
  const text = norm(fileName);
  const tokens = text.split(" ").filter(Boolean);

  // 1. Stable card ID (e.g. "r14_messi.png").
  const idToken = tokens.find((t) => /^r\d+$/.test(t));
  if (idToken) {
    const byId = players.find((p) => p.id === idToken);
    if (byId)
      return { fileName, group: "matched", candidates: [{ player: byId, reason: "Card ID" }] };
  }

  // 2. Player name contained in the file name.
  const flat = compact(fileName);
  const nameMatches = players.filter((p) => {
    const name = norm(p.playerName);
    if (!name) return false;
    return text.includes(name) || flat.includes(compact(p.playerName));
  });

  if (nameMatches.length === 0) return { fileName, group: "unmatched", candidates: [] };
  if (nameMatches.length === 1) {
    return {
      fileName,
      group: "matched",
      candidates: [{ player: nameMatches[0]!, reason: "Player name" }],
    };
  }

  // 3. Same name on several cards — OVR and position must disambiguate.
  const refined = nameMatches.filter((p) => {
    const ovrHit = p.ovr !== null && tokens.includes(String(p.ovr));
    const posHit = Boolean(p.position) && tokens.includes(norm(p.position));
    return ovrHit && posHit;
  });
  if (refined.length === 1) {
    return {
      fileName,
      group: "matched",
      candidates: [{ player: refined[0]!, reason: "Name + OVR + position" }],
    };
  }

  const candidates = (refined.length > 1 ? refined : nameMatches)
    .slice(0, 8)
    .map((player) => ({ player, reason: "Possible match" }));
  return { fileName, group: "review", candidates };
}
