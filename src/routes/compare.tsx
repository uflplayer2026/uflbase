import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { PlayerCard } from "@/components/PlayerCard";
import { CardPicker } from "@/components/CardPicker";
import { CardGridSkeleton, ErrorState, EmptyState } from "@/components/CardsState";
import { playersSnapshotQueryOptions } from "@/lib/playersQuery";
import { STAT_KEYS } from "@/lib/playerTypes";
import type { PlayerCardRecord } from "@/lib/playerTypes";

type Search = { a?: string | undefined; b?: string | undefined };

export const Route = createFileRoute("/compare")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    a: typeof search["a"] === "string" && search["a"] !== "" ? search["a"] : undefined,
    b: typeof search["b"] === "string" && search["b"] !== "" ? search["b"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Compare Cards — UFL Mobile Player Card Database" },
      {
        name: "description",
        content:
          "Compare any two UFL Mobile player cards side by side: OVR, position, nation, PAC, SHO, PAS, DRI, DEF, PHY and perks.",
      },
      { property: "og:title", content: "Compare Cards — UFL Mobile Player Card Database" },
      {
        property: "og:description",
        content: "Put two UFL Mobile player cards head to head and see which stats win.",
      },
    ],
  }),
  component: ComparePage,
});

function statClass(value: number | null, other: number | null) {
  if (value === null && other === null) return "compare-neutral";
  if (value === null) return "compare-lower";
  if (other === null) return "compare-higher";
  if (value > other) return "compare-higher";
  if (value < other) return "compare-lower";
  return "compare-neutral";
}

function Meta({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="compare-row">
      <span className="compare-value compare-neutral">{a || "—"}</span>
      <span className="compare-label">{label}</span>
      <span className="compare-value compare-neutral">{b || "—"}</span>
    </div>
  );
}

function ComparePage() {
  const { a, b } = Route.useSearch();
  const navigate = useNavigate({ from: "/compare" });
  const { data, isPending, isError, error, refetch } = useQuery(playersSnapshotQueryOptions);
  const players = useMemo(() => data?.players ?? [], [data]);

  const cardA = useMemo(() => players.find((p) => p.id === a) ?? null, [players, a]);
  const cardB = useMemo(() => players.find((p) => p.id === b) ?? null, [players, b]);

  const set = (patch: Search) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-4">
        <h1 className="text-2xl font-bold sm:text-3xl">Compare Cards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick two cards to see every stat head to head. Each spreadsheet row is its own card.
        </p>
      </header>

      {isPending ? (
        <CardGridSkeleton count={2} />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : players.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-5 grid gap-3 md:grid-cols-2">
            <CardPicker
              label="Card 1"
              players={players}
              selectedId={cardA?.id ?? null}
              onSelect={(id) => set({ a: id })}
              onClear={() => set({ a: undefined })}
            />
            <CardPicker
              label="Card 2"
              players={players}
              selectedId={cardB?.id ?? null}
              onSelect={(id) => set({ b: id })}
              onClear={() => set({ b: undefined })}
            />
          </div>

          {(cardA || cardB) && (
            <div className="mb-5 flex justify-center">
              <button
                type="button"
                className="btn-secondary focus-ring"
                onClick={() => set({ a: undefined, b: undefined })}
              >
                Clear comparison
              </button>
            </div>
          )}

          {cardA && cardB ? (
            <ComparisonResult cardA={cardA} cardB={cardB} />
          ) : (
            <p className="surface-panel text-center text-sm text-muted-foreground">
              Select two cards above to start comparing.
              <ArrowRight className="ml-1 inline size-4 align-text-bottom" aria-hidden />
            </p>
          )}
        </>
      )}
    </main>
  );
}

function ComparisonResult({ cardA, cardB }: { cardA: PlayerCardRecord; cardB: PlayerCardRecord }) {
  return (
    <section aria-label="Comparison result" className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <PlayerCard player={cardA} />
        <PlayerCard player={cardB} />
      </div>

      <div className="surface-panel space-y-1 p-3">
        <Meta label="Player" a={cardA.playerName} b={cardB.playerName} />
        <Meta label="Position" a={cardA.position} b={cardB.position} />
        <Meta label="Nation" a={cardA.nation} b={cardB.nation} />

        <div className="compare-row">
          <span className={`compare-value ${statClass(cardA.ovr, cardB.ovr)}`}>
            {cardA.ovr ?? "—"}
          </span>
          <span className="compare-label">OVR</span>
          <span className={`compare-value ${statClass(cardB.ovr, cardA.ovr)}`}>
            {cardB.ovr ?? "—"}
          </span>
        </div>

        {STAT_KEYS.map((key) => (
          <div key={key} className="compare-row">
            <span className={`compare-value ${statClass(cardA[key], cardB[key])}`}>
              {cardA[key] ?? "—"}
            </span>
            <span className="compare-label">{key.toUpperCase()}</span>
            <span className={`compare-value ${statClass(cardB[key], cardA[key])}`}>
              {cardB[key] ?? "—"}
            </span>
          </div>
        ))}

        {cardA.perk || cardB.perk ? (
          <Meta label="Perk" a={cardA.perk} b={cardB.perk} />
        ) : null}
      </div>
    </section>
  );
}
