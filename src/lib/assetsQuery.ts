import { useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { getCardAssets, type CardAssetLink } from "./assets.functions";
import { variantKey } from "./cardIdentity";
import type { PlayerCardRecord } from "./playerTypes";

/** One shared, cached read of every card image / background assignment. */
export const cardAssetsQueryOptions = queryOptions({
  queryKey: ["card-assets"],
  queryFn: () => getCardAssets(),
  staleTime: 60_000,
  retry: false,
});

export type CardAssetMap = Map<string, CardAssetLink>;

export function useCardAssetMap(): CardAssetMap {
  const { data } = useQuery(cardAssetsQueryOptions);
  return useMemo(() => new Map((data ?? []).map((link) => [link.variantKey, link])), [data]);
}

/** Resolved art for one card: the assigned image wins over the Sheet value; both are separate. */
export function resolveCardArt(player: PlayerCardRecord, map: CardAssetMap) {
  const link = map.get(variantKey(player));
  return {
    imageUrl: link?.cardImage?.url ?? (player.cardImage || null),
    backgroundUrl: link?.background?.url ?? null,
    imageFromAsset: Boolean(link?.cardImage),
  };
}
