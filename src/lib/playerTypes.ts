export type PlayerCardRecord = {
  id: string;
  playerName: string;
  ovr: number | null;
  position: string;
  nation: string;
  pac: number | null;
  sho: number | null;
  pas: number | null;
  dri: number | null;
  def: number | null;
  phy: number | null;
  perk: string;
  cardImage: string;
};

export type PlayersSnapshot = {
  players: PlayerCardRecord[];
  cardCount: number;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastDurationMs: number | null;
  lastStatus: string | null;
  lastError: string | null;
  syncing: boolean;
  nextSyncAt: string | null;
  intervalMinutes: number;
};

export const STAT_KEYS = ["pac", "sho", "pas", "dri", "def", "phy"] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type SortKey = StatKey | "ovr" | "playerName";
