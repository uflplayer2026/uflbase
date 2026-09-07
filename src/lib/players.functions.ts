import { createServerFn } from "@tanstack/react-start";
import type { PlayersSnapshot } from "./playerTypes";

export type { PlayerCardRecord, PlayersSnapshot } from "./playerTypes";

/** Public read: always served from the centralized server-side cache. */
export const getPlayersSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlayersSnapshot> => {
    const { getSnapshot } = await import("./sheets.server");
    return getSnapshot();
  },
);
