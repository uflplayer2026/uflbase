import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import {
  assignCardTypeBackground,
  getCardTypes,
  removeCardTypeMapping,
  type CardTypeEntry,
} from "@/lib/cardTypes.functions";
import type { AssetRecord } from "@/lib/assetTypes";
import type { PlayerCardRecord } from "@/lib/playerTypes";
import { useCardAssetMap } from "@/lib/assetsQuery";
import { variantKey } from "@/lib/cardIdentity";

/**
 * CARD TYPE -> CARD BACKGROUND rules. Nothing is ever guessed: a card type stays
 * "Background unassigned" until an administrator saves a rule.
 */
export function CardTypesTab({
  assets,
  players,
  onChanged,
}: {
  assets: AssetRecord[];
  players: PlayerCardRecord[];
  onChanged: () => void;
}) {
  const listFn = useServerFn(getCardTypes);
  const assignFn = useServerFn(assignCardTypeBackground);
  const removeFn = useServerFn(removeCardTypeMapping);
  const assetMap = useCardAssetMap();

  const backgrounds = useMemo(
    () => assets.filter((a) => a.type === "CARD_BACKGROUND"),
    [assets],
  );
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const types = useQuery({ queryKey: ["card-types"], queryFn: () => listFn(), retry: false });

  // Cards whose background was set by hand are never touched by a card type rule.
  const overrideCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of players) {
      const type = (p.cardType ?? "").trim();
      if (!type) continue;
      if (assetMap.get(variantKey(p))?.backgroundManual) {
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
    }
    return counts;
  }, [players, assetMap]);

  const save = async (entry: CardTypeEntry, assetId: string | null) => {
    if (entry.background && assetId && assetId !== entry.background.id) {
      const overrides = overrideCounts.get(entry.cardType) ?? 0;
      const ok = window.confirm(
        `Switch every “${entry.cardType}” card that inherits its background to the new one?${
          overrides ? ` ${overrides} card(s) with a manual override keep theirs.` : ""
        }`,
      );
      if (!ok) return;
    }
    try {
      await assignFn({ data: { cardType: entry.cardType, assetId } });
      setNotice(
        assetId
          ? `Saved — “${entry.cardType}” cards now inherit this background.`
          : `“${entry.cardType}” saved as deliberately unassigned.`,
      );
      await types.refetch();
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The assignment could not be saved.");
    }
  };

  const clear = async (entry: CardTypeEntry) => {
    if (!window.confirm(`Remove the background rule for “${entry.cardType}”?`)) return;
    await removeFn({ data: { cardType: entry.cardType } });
    setNotice(`Rule removed for “${entry.cardType}”.`);
    await types.refetch();
    onChanged();
  };

  const rows = types.data ?? [];
  const unassigned = rows.filter((r) => !r.background);

  return (
    <div className="space-y-5">
      <section className="surface-panel">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Unassigned card types ({unassigned.length})
        </h2>
        {types.isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading card types…</p>
        ) : types.isError ? (
          <p className="mt-2 text-sm text-destructive">{(types.error as Error).message}</p>
        ) : unassigned.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Every card type from the sheet has a background rule.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {unassigned.map((row) => (
              <li key={row.cardType} className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden />
                <span className="font-semibold">{row.cardType}</span>
                <span className="text-muted-foreground">
                  · {row.cardCount} cards · Background unassigned
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface-panel">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Card type → card background
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No card types detected yet. They appear after the next sheet synchronization.
          </p>
        ) : (
          <ul className="space-y-4">
            {rows.map((row) => {
              const selected = choice[row.cardType] ?? row.background?.id ?? "";
              const overrides = overrideCounts.get(row.cardType) ?? 0;
              return (
                <li key={row.cardType} className="border-b border-border/60 pb-4 last:border-0">
                  <div className="flex flex-wrap items-start gap-3">
                    {row.background ? (
                      <img
                        src={row.background.url}
                        alt=""
                        className="size-16 rounded object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="grid size-16 place-items-center rounded border border-dashed border-border text-[10px] text-muted-foreground">
                        None
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{row.cardType}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.cardCount} cards ·{" "}
                        {row.background ? "Inherited from card type" : "Background unassigned"}
                        {overrides ? ` · ${overrides} manual override(s)` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <label className="block text-sm">
                          <span className="filter-label">Background</span>
                          <select
                            className="field focus-ring mt-1 min-h-11 w-full min-w-48"
                            value={selected}
                            onChange={(e) =>
                              setChoice((prev) => ({ ...prev, [row.cardType]: e.target.value }))
                            }
                          >
                            <option value="">Choose background</option>
                            {backgrounds.map((bg) => (
                              <option key={bg.id} value={bg.id}>
                                {bg.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="btn-primary h-11"
                          disabled={!selected}
                          onClick={() => save(row, selected || null)}
                        >
                          Save assignment
                        </button>
                        {row.mapped ? (
                          <button
                            type="button"
                            className="btn-secondary h-11"
                            onClick={() => clear(row)}
                          >
                            Remove rule
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {notice ? <p className="mt-3 text-sm text-muted-foreground">{notice}</p> : null}
      </section>
    </div>
  );
}
