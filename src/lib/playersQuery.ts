import { queryOptions } from "@tanstack/react-query";
import { getPlayerCards } from "./players.functions";

export const playerCardsQueryOptions = queryOptions({
  queryKey: ["player-cards"],
  queryFn: () => getPlayerCards(),
  staleTime: 60_000,
  retry: false,
});
