import { queryOptions } from "@tanstack/react-query";
import { getPlayersSnapshot } from "./players.functions";

export const playersSnapshotQueryOptions = queryOptions({
  queryKey: ["players-snapshot"],
  queryFn: () => getPlayersSnapshot(),
  staleTime: 60_000,
  retry: false,
});

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}
