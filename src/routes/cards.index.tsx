import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, X } from "lucide-react";
import { PlayerCard } from "@/components/PlayerCard";
import { FavoriteButton } from "@/components/FavoriteButton";

import {
  CardGridSkeleton,
  ErrorState,
  EmptyState,
  NoResultsState,
} from "@/components/CardsState";
import { playersSnapshotQueryOptions, formatDateTime } from "@/lib/playersQuery";
import type { PlayerCardRecord, SortKey } from "@/lib/playerTypes";

type Search = {
  q?: string | undefined;
  position?: string | undefined;
  nation?: string | undefined;
  sort?: SortKey | undefined;
  dir?: "asc" | "desc" | undefined;
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "ovr", label: "OVR" },
  { key: "playerName", label: "Player Name" },
  { key: "pac", label: "PAC" },
  { key: "sho", label: "SHO" },
  { key: "pas", label: "PASS" },
  { key: "dri", label: "DRIB" },
  { key: "def", label: "DEF" },
  { key: "phy", label: "PHY" },
];


const PAGE_SIZE = 60;

export const Route = createFileRoute("/cards/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search["q"] === "string" && search["q"] !== "" ? search["q"] : undefined,
    position:
      typeof search["position"] === "string" && search["position"] !== ""
        ? search["position"]
        : undefined,
    nation:
      typeof search["nation"] === "string" && search["nation"] !== "" ? search["nation"] : undefined,
    sort: SORT_OPTIONS.some((o) => o.key === search["sort"]) ? (search["sort"] as SortKey) : undefined,
    dir: search["dir"] === "asc" ? "asc" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Card Database — UFL Mobile Player Cards" },
      {
        name: "description",
        content:
          "Search, filter and sort every UFL Mobile player card in the community database by OVR, position, nation and stats.",
      },
      { property: "og:title", content: "Card Database — UFL Mobile Player Cards" },
      {
        property: "og:description",
        content: "Search, filter and sort every UFL Mobile player card in the community database.",
      },
    ],
  }),
  component: CardsPage,
});

function compare(a: PlayerCardRecord, b: PlayerCardRecord, sort: SortKey) {
  if (sort === "playerName") return a.playerName.localeCompare(b.playerName);
  const av = a[sort];
  const bv = b[sort];
  if (av === null && bv === null) return 0;
  if (av === null) return -1;
  if (bv === null) return 1;
  return av - bv;
}

function CardsPage() {
  const rawSearch = Route.useSearch();
  const search = {
    q: rawSearch.q ?? "",
    position: rawSearch.position ?? "",
    nation: rawSearch.nation ?? "",
    sort: rawSearch.sort ?? ("ovr" as SortKey),
    dir: rawSearch.dir ?? ("desc" as const),
  };
  const navigate = useNavigate({ from: "/cards/" });
  const [visible, setVisible] = useState(PAGE_SIZE);
  const { data, isPending, isError, error, refetch } = useQuery(playersSnapshotQueryOptions);

  const players = data?.players ?? [];

  const { positions, nations } = useMemo(() => {
    const p = new Set<string>();
    const n = new Set<string>();
    for (const player of players) {
      if (player.position) p.add(player.position);
      if (player.nation) n.add(player.nation);
    }
    return {
      positions: [...p].sort((a, b) => a.localeCompare(b)),
      nations: [...n].sort((a, b) => a.localeCompare(b)),
    };
  }, [players]);

  const filtered = useMemo(() => {
    const q = search.q.trim().toLowerCase();
    const result = players.filter(
      (p) =>
        (q === "" || p.playerName.toLowerCase().includes(q)) &&
        (search.position === "" || p.position === search.position) &&
        (search.nation === "" || p.nation === search.nation),
    );
    result.sort((a, b) => (search.dir === "asc" ? 1 : -1) * compare(a, b, search.sort));
    return result;
  }, [players, search.q, search.position, search.nation, search.sort, search.dir]);

  const setSearch = (patch: Partial<Search>) => {
    setVisible(PAGE_SIZE);
    const next: Search = { ...search, ...patch };
    navigate({
      search: {
        q: next.q || undefined,
        position: next.position || undefined,
        nation: next.nation || undefined,
        sort: next.sort === "ovr" ? undefined : next.sort,
        dir: next.dir === "desc" ? undefined : next.dir,
      },
      replace: true,
    });
  };

  const clearFilters = () => setSearch({ q: "", position: "", nation: "" });
  const activeFilters = [
    search.q ? { key: "q" as const, label: `Name: ${search.q}` } : null,
    search.position ? { key: "position" as const, label: `Position: ${search.position}` } : null,
    search.nation ? { key: "nation" as const, label: `Nation: ${search.nation}` } : null,
  ].filter(Boolean) as { key: "q" | "position" | "nation"; label: string }[];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-4">
        <h1 className="text-2xl font-bold sm:text-3xl">Card Database</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {data ? `${filtered.length} of ${data.cardCount} cards` : "Loading…"}
          {data ? ` · Last synced: ${formatDateTime(data.lastSuccessAt)}` : ""}
        </p>
      </header>

      <section aria-label="Search and filters" className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="search"
          value={search.q}
          onChange={(e) => setSearch({ q: e.target.value })}
          placeholder="Search player name…"
          aria-label="Search player name"
          className="field focus-ring min-h-11 sm:col-span-2 lg:col-span-1"
        />
        <select
          value={search.position}
          onChange={(e) => setSearch({ position: e.target.value })}
          aria-label="Filter by position"
          className="field focus-ring min-h-11"
        >
          <option value="">All positions</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={search.nation}
          onChange={(e) => setSearch({ nation: e.target.value })}
          aria-label="Filter by nation"
          className="field focus-ring min-h-11"
        >
          <option value="">All nations</option>
          {nations.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            value={search.sort}
            onChange={(e) => setSearch({ sort: e.target.value as SortKey })}
            aria-label="Sort by"
            className="field focus-ring min-h-11 flex-1"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                Sort: {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSearch({ dir: search.dir === "asc" ? "desc" : "asc" })}
            className="field focus-ring flex min-h-11 items-center gap-1 px-3"
            aria-label={`Sort direction: ${search.dir === "asc" ? "ascending" : "descending"}. Activate to switch.`}
          >
            <ArrowDownUp className="size-4" aria-hidden />
            {search.dir === "asc" ? "ASC" : "DESC"}
          </button>
        </div>
      </section>

      {activeFilters.length > 0 ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              className="chip focus-ring"
              onClick={() => setSearch({ [f.key]: "" } as Partial<Search>)}
              aria-label={`Remove filter ${f.label}`}
            >
              {f.label}
              <X className="size-3.5" aria-hidden />
            </button>
          ))}
          <button type="button" className="btn-secondary focus-ring" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : null}

      {isPending ? (
        <CardGridSkeleton count={10} />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : players.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <NoResultsState onClear={clearFilters} />
      ) : (
        <>
          <div className="card-grid">
            {filtered.slice(0, visible).map((player) => (
              <div key={player.id} className="relative">
                <FavoriteButton
                  cardId={player.id}
                  name={player.playerName}
                  className="card-action card-action-fav"
                />
                <Link
                  to="/cards/$cardId"
                  params={{ cardId: player.id }}
                  className="focus-ring block rounded-xl"
                  aria-label={`View card details for ${player.playerName || "player"}`}
                >
                  <PlayerCard player={player} />
                </Link>
              </div>
            ))}

          </div>
          {visible < filtered.length ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                className="btn-primary focus-ring"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
              >
                Load more ({filtered.length - visible} left)
              </button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
