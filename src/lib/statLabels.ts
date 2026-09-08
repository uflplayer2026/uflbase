import type { StatKey, SortKey } from "./playerTypes";

/** Canonical spreadsheet field labels. Never render "PAS" or "DRI". */
export const STAT_LABELS: Record<StatKey, string> = {
  pac: "PAC",
  sho: "SHO",
  pas: "PASS",
  dri: "DRIB",
  def: "DEF",
  phy: "PHY",
};

export const SORT_LABELS: Record<SortKey, string> = {
  ...STAT_LABELS,
  ovr: "OVR",
  playerName: "Player Name",
};
