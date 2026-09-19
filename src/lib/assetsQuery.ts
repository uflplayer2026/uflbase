import { useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { getCardAssets, type CardAssetLink } from "./assets.functions";
import { getCardTypeBackgrounds, type CardTypeBackground } from "./cardTypes.functions";
import { variantKey } from "./cardIdentity";
import type { PlayerCardRecord } from "./playerTypes";
import {
  computeComposition,
  DEFAULT_SAFE_AREA,
  type CompositionResult,
  type ProtectedArea,
  type SafeArea,
} from "./cardComposition";

/** One shared, cached read of every card image / background assignment. */
export const cardAssetsQueryOptions = queryOptions({
  queryKey: ["card-assets"],
  queryFn: () => getCardAssets(),
  staleTime: 60_000,
  retry: false,
});

/** One shared, cached read of the CARD TYPE -> CARD BACKGROUND rules. */
export const cardTypeBackgroundsQueryOptions = queryOptions({
  queryKey: ["card-type-backgrounds"],
  queryFn: () => getCardTypeBackgrounds(),
  staleTime: 60_000,
  retry: false,
});

export type CardAssetMap = Map<string, CardAssetLink>;
export type CardTypeMap = Map<string, CardTypeBackground["background"]>;

const normalizeType = (value: string) => value.trim().toLowerCase();

export function useCardAssetMap(): CardAssetMap {
  const { data } = useQuery(cardAssetsQueryOptions);
  return useMemo(() => new Map((data ?? []).map((link) => [link.variantKey, link])), [data]);
}

export function useCardTypeMap(): CardTypeMap {
  const { data } = useQuery(cardTypeBackgroundsQueryOptions);
  return useMemo(
    () => new Map((data ?? []).map((row) => [normalizeType(row.cardType), row.background])),
    [data],
  );
}

export type CardArt = {
  imageUrl: string | null;
  backgroundUrl: string | null;
  imageFromAsset: boolean;
  /** Where the background came from: an explicit per-card choice or the card type rule. */
  backgroundSource: "manual" | "card-type" | "none";
  composition: CompositionResult;
  compositionManual: boolean;
  safeArea: SafeArea;
  protectedAreas: ProtectedArea[];
};

/**
 * Resolution priority:
 *   1. manual per-card background override
 *   2. CARD TYPE -> CARD BACKGROUND mapping
 *   3. unassigned (no background)
 * Card Image and Card Background stay independent assets throughout.
 */
export function resolveCardArt(
  player: PlayerCardRecord,
  map: CardAssetMap,
  typeMap?: CardTypeMap,
): CardArt {
  const link = map.get(variantKey(player));
  const inherited = typeMap?.get(normalizeType(player.cardType ?? "")) ?? null;

  const manual = link?.backgroundManual ? link.background : null;
  const background = manual ?? inherited ?? null;
  const safeArea = background?.safeArea ?? DEFAULT_SAFE_AREA;
  const protectedAreas = background?.protectedAreas ?? [];

  const composition = computeComposition({
    safeArea,
    protectedAreas,
    imageWidth: link?.cardImage?.width ?? null,
    imageHeight: link?.cardImage?.height ?? null,
    override: link?.composition ?? null,
  });

  return {
    imageUrl: link?.cardImage?.url ?? (player.cardImage || null),
    backgroundUrl: background?.url ?? null,
    imageFromAsset: Boolean(link?.cardImage),
    backgroundSource: manual ? "manual" : inherited ? "card-type" : "none",
    composition,
    compositionManual: Boolean(link?.composition),
    safeArea,
    protectedAreas,
  };
}
