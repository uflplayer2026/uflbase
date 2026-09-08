import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlayerCard } from "@/components/PlayerCard";
import { CardGridSkeleton, ErrorState, EmptyState, NoResultsState } from "@/components/CardsState";
import { playersSnapshotQueryOptions, formatDateTime } from "@/lib/playersQuery";
import { STAT_KEYS } from "@/lib/playerTypes";
import type { PlayerCardRecord, SortKey } from "@/lib/playerTypes";

type Metric = "ovr" | (typeof STAT_KEYS)[number];
const METRICS: { key: Metric; label: string }[] = [
  { key: "ovr", label: "Highest OVR" },
  { key: "pac", label: "Highest PAC" },
  { key: "sho", label: "Highest SHO" },
  { key: "pas", label: "Highest PASS" },
  { key: "dri", label: "Highest DRIB" },
  { key: "def", label: "Highest DEF" },
  { key: "phy", label: "Highest PHY" },
];


const TOP_N = 12;

type Search = { metric?: Metric | undefined; position?: string | undefined };

export const Route = createFileRoute("/best")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    metric: METRICS.some((m) => m.key === search["metric"]) ? (search["metric"] as Metric) : undefined,
    position:
      typeof search["position"] === "string" && search["position"] !== ""
        ? search["position"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Best Players — UFL Mobile Top Cards" },
      {
        name: "description",
        content:
          "Automatically ranked UFL Mobile top cards by OVR, PAC, SHO, PAS, DRI, DEF and PHY, filterable by position.",
      },
      { property: "og:title", content: "Best Players — UFL Mobile Top Cards" },
      {
        property: "og:description",
        content: "Live rankings of the top UFL Mobile cards by rating and by individual stat.",
      },
    ],
  }),
  component: BestPage,
});

function BestPage() {
  const raw = Route.useSearch();
  const metric: Metric = raw.metric ?? "ovr";
  const position = raw.position ?? "";
  const navigate = useNavigate({ from: "/best" });
  const { data, isPending, isError, error, refetch } = useQuery(playersSnapshotQueryOptions);
  const players = useMemo(() => data?.players ?? [], [data]);

  const positions = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) if (p.position) set.add(p.position);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [players]);

  const ranked = useMemo(() => {
    const key = metric as SortKey;
    const pool = position === "" ? players : players.filter((p) => p.position === position);
    return pool
      .filter((p) => p[key as keyof PlayerCardRecord] !== null)
      .sort((a, b) => ((b[key] as number | null) ?? -1) - ((a[key] as number | null) ?? -1))
      .slice(0, TOP_N);
  }, [players, metric, position]);

  const set = (patch: Search) =>
    navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        ...(patch.metric === "ovr" ? { metric: undefined } : {}),
        ...(patch.position === "" ? { position: undefined } : {}),
      }),
      replace: true,
    });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-4">
        <h1 className="text-2xl font-bold sm:text-3xl">Best Players</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Rankings calculated live from the synced dataset
          {data ? ` · Last synced: ${formatDateTime(data.lastSuccessAt)}` : ""}
        </p>
      </header>

      <div className="mb-3 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 pb-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              className="chip focus-ring"
              data-active={m.key === metric ? "true" : undefined}
              onClick={() => set({ metric: m.key })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select
          value={position}
          onChange={(e) => set({ position: e.target.value })}
          aria-label="Filter rankings by position"
          className="field focus-ring min-h-11"
        >
          <option value="">All positions</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              Best {p}
            </option>
          ))}
        </select>
        {position ? (
          <button type="button" className="btn-secondary focus-ring" onClick={() => set({ position: "" })}>
            Clear filter
          </button>
        ) : null}
        <span className="text-xs text-muted-foreground">{ranked.length} cards ranked</span>
      </div>

      {isPending ? (
        <CardGridSkeleton count={8} />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : players.length === 0 ? (
        <EmptyState />
      ) : ranked.length === 0 ? (
        <NoResultsState onClear={() => set({ position: "" })} />
      ) : (
        <ol className="card-grid list-none">
          {ranked.map((player, i) => (
            <li key={player.id} className="relative">
              <span className="rank-badge" aria-hidden>
                #{i + 1}
              </span>
              <Link
                to="/cards/$cardId"
                params={{ cardId: player.id }}
                className="focus-ring block rounded-xl"
                aria-label={`Rank ${i + 1}: view card details for ${player.playerName || "player"}`}
              >
                <PlayerCard player={player} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
