import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ErrorState, EmptyState, LoadingState } from "@/components/CardsState";
import { playersSnapshotQueryOptions, formatDateTime } from "@/lib/playersQuery";
import { STAT_KEYS } from "@/lib/playerTypes";
import { STAT_LABELS } from "@/lib/statLabels";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Database Statistics — UFLBase" },
      {
        name: "description",
        content:
          "Live UFL Mobile card database statistics: total cards, average and highest OVR, best PAC, SHO, PASS, DRIB, DEF and PHY, nations, positions and perks.",
      },
      { property: "og:title", content: "Database Statistics — UFLBase" },
      {
        property: "og:description",
        content: "Live statistics calculated from the synced UFL Mobile card dataset.",
      },
    ],
  }),
  component: StatsPage,
});

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-value">{value}</span>
      <span className="stat-tile-label">{label}</span>
    </div>
  );
}

function StatsPage() {
  const { data, isPending, isError, error, refetch } = useQuery(playersSnapshotQueryOptions);
  const players = data?.players ?? [];

  const stats = useMemo(() => {
    if (players.length === 0) return null;
    const nations = new Set<string>();
    const positions = new Set<string>();
    let perks = 0;
    let ovrSum = 0;
    let ovrCount = 0;
    let highestOvr: number | null = null;
    const highest: Record<string, number | null> = {};
    for (const key of STAT_KEYS) highest[key] = null;

    for (const p of players) {
      if (p.nation) nations.add(p.nation);
      if (p.position) positions.add(p.position);
      if (p.perk) perks += 1;
      if (p.ovr !== null) {
        ovrSum += p.ovr;
        ovrCount += 1;
        if (highestOvr === null || p.ovr > highestOvr) highestOvr = p.ovr;
      }
      for (const key of STAT_KEYS) {
        const v = p[key];
        const cur = highest[key];
        if (v !== null && (cur === null || cur === undefined || v > cur)) highest[key] = v;
      }
    }

    return {
      total: players.length,
      averageOvr: ovrCount > 0 ? (ovrSum / ovrCount).toFixed(1) : "—",
      highestOvr: highestOvr === null ? "—" : String(highestOvr),
      highest,
      nations: nations.size,
      positions: positions.size,
      perks,
    };
  }, [players]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-5">
        <h1 className="text-2xl font-bold sm:text-3xl">Database Statistics</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Calculated from the synced dataset
          {data ? ` · Last synced: ${formatDateTime(data.lastSuccessAt)}` : ""}
        </p>
      </header>

      {isPending ? (
        <LoadingState label="Loading statistics…" />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : !stats ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <section aria-label="Overview" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Total Cards" value={String(stats.total)} />
            <Tile label="Average OVR" value={stats.averageOvr} />
            <Tile label="Highest OVR" value={stats.highestOvr} />
            <Tile label="Cards with Perk" value={String(stats.perks)} />
          </section>

          <section aria-label="Highest stats">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Highest stats
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {STAT_KEYS.map((key) => (
                <Tile
                  key={key}
                  label={`Highest ${STAT_LABELS[key]}`}
                  value={stats.highest[key] === null ? "—" : String(stats.highest[key])}
                />
              ))}
            </div>
          </section>

          <section aria-label="Coverage">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Coverage
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="Unique Nations" value={String(stats.nations)} />
              <Tile label="Unique Positions" value={String(stats.positions)} />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
