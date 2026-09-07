import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlayerCard } from "@/components/PlayerCard";
import { CardGridSkeleton, ErrorState, EmptyState } from "@/components/CardsState";
import { playersSnapshotQueryOptions, formatDateTime } from "@/lib/playersQuery";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UFL Mobile Player Card Database" },
      {
        name: "description",
        content:
          "Browse every UFL Mobile player card with OVR, position, nation, PAC/SHO/PAS/DRI/DEF/PHY stats and perks. Community-made and always in sync with the source sheet.",
      },
      { property: "og:title", content: "UFL Mobile Player Card Database" },
      {
        property: "og:description",
        content: "Browse every UFL Mobile player card with full ratings, stats and perks.",
      },
    ],
  }),
  component: Index,
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-value">{value}</span>
      <span className="stat-tile-label">{label}</span>
    </div>
  );
}

function Index() {
  const { data, isPending, isError, error, refetch } = useQuery(playersSnapshotQueryOptions);
  const players = data?.players;

  const stats = useMemo(() => {
    if (!players || players.length === 0) return null;
    const positions = new Set<string>();
    const nations = new Set<string>();
    let topOvr: number | null = null;
    for (const p of players) {
      if (p.position) positions.add(p.position);
      if (p.nation) nations.add(p.nation);
      if (p.ovr !== null && (topOvr === null || p.ovr > topOvr)) topOvr = p.ovr;
    }
    return { cards: players.length, positions: positions.size, nations: nations.size, topOvr };
  }, [players]);

  const featured = useMemo(() => {
    if (!players) return [];
    return [...players]
      .sort((a, b) => (b.ovr ?? -1) - (a.ovr ?? -1))
      .slice(0, 8);
  }, [players]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-14">
      <section className="hero-panel text-center">
        <span className="pill">Community project</span>
        <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-5xl">
          UFL Mobile <span className="text-accent">Player Card</span> Database
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Every card, with its rating, position, nation, all six stats and perk — searchable,
          filterable and built for your phone.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/cards" className="btn-primary focus-ring">
            Browse cards
          </Link>
          <Link to="/about" className="btn-secondary focus-ring">
            How it works
          </Link>
        </div>

        {stats ? (
          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Cards" value={String(stats.cards)} />
            <Stat label="Positions" value={String(stats.positions)} />
            <Stat label="Nations" value={String(stats.nations)} />
            {stats.topOvr !== null ? <Stat label="Highest OVR" value={String(stats.topOvr)} /> : null}
          </div>
        ) : null}

        {data ? (
          <p className="mt-5 text-xs text-muted-foreground">
            Last synced: {formatDateTime(data.lastSuccessAt)}
          </p>
        ) : null}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">Highest rated cards</h2>
          <Link to="/cards" className="focus-ring rounded text-sm font-medium text-accent hover:underline">
            View all →
          </Link>
        </div>
        {isPending ? (
          <CardGridSkeleton count={8} />
        ) : isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
        ) : featured.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="card-grid">
            {featured.map((player) => (
              <Link
                key={player.id}
                to="/cards/$cardId"
                params={{ cardId: player.id }}
                className="focus-ring block rounded-xl"
                aria-label={`View card details for ${player.playerName || "player"}`}
              >
                <PlayerCard player={player} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
