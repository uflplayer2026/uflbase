import { memo, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlayerCard } from "@/components/PlayerCard";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CompareButton } from "@/components/CompareButton";
import { CardGridSkeleton, ErrorState } from "@/components/CardsState";
import { getRecentChanges, type CardChange, type ChangeView } from "@/lib/changes.functions";
import { STAT_LABELS } from "@/lib/statLabels";
import { formatDateTime } from "@/lib/playersQuery";

type Search = { view?: ChangeView | undefined; hours?: number | undefined };

const VIEWS: { key: ChangeView; label: string }[] = [
  { key: "added", label: "Recently Added" },
  { key: "updated", label: "Recently Updated" },
  { key: "variants", label: "New Variants" },
];

const EMPTY: Record<ChangeView, string> = {
  added: "No cards added recently.",
  updated: "No recently updated cards.",
  variants: "No new variants detected.",
};

const FIELD_LABELS: Record<string, string> = {
  nation: "Nation",
  cardImage: "Card Image",
  pac: STAT_LABELS.pac,
  sho: STAT_LABELS.sho,
  pas: STAT_LABELS.pas,
  dri: STAT_LABELS.dri,
  def: STAT_LABELS.def,
  phy: STAT_LABELS.phy,
};

export const Route = createFileRoute("/recent")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    view: VIEWS.some((v) => v.key === search["view"]) ? (search["view"] as ChangeView) : undefined,
    hours: search["hours"] === 24 || search["hours"] === "24" ? 24 : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Recently Changed — UFL Mobile Card Database" },
      {
        name: "description",
        content:
          "See which UFL Mobile player cards were recently added, which records were updated and which new card variants appeared in the database.",
      },
      { property: "og:title", content: "Recently Changed — UFL Mobile Card Database" },
      {
        property: "og:description",
        content: "Newly added cards, updated card records and newly detected card variants.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecentPage,
});

const ChangeCard = memo(function ChangeCard({ change }: { change: CardChange }) {
  const fields = change.changedFields
    .map((f) => FIELD_LABELS[f] ?? f)
    .filter(Boolean)
    .join(", ");
  return (
    <div className="relative">
      <div className="card-action card-action-stack">
        <FavoriteButton cardId={change.player.id} name={change.player.playerName} />
        <CompareButton cardId={change.player.id} name={change.player.playerName} />
      </div>
      <Link
        to="/cards/$cardId"
        params={{ cardId: change.player.id }}
        className="focus-ring block rounded-xl"
        aria-label={`View card details for ${change.player.playerName || "player"}`}
      >
        <PlayerCard player={change.player} />
      </Link>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {formatDateTime(change.at)}
        {fields ? ` · Changed: ${fields}` : ""}
      </p>
    </div>
  );
});

function RecentPage() {
  const raw = Route.useSearch();
  const navigate = useNavigate({ from: "/recent" });
  const view: ChangeView = raw.view ?? "added";
  const hours = view === "added" && raw.hours === 24 ? 24 : 24 * 7;

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["recent-changes", view, hours],
    queryFn: () => getRecentChanges({ data: { view, hours } }),
    staleTime: 60_000,
    retry: false,
  });

  const changes = useMemo(() => data ?? [], [data]);

  const set = (patch: Search) =>
    navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        ...(patch.view === "added" ? { view: undefined } : {}),
        ...(patch.hours === 24 * 7 ? { hours: undefined } : {}),
      }),
      replace: true,
    });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-4">
        <h1 className="text-2xl font-bold sm:text-3xl">Recently Changed</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          New cards, updated card records and newly detected variants — detected by the continuous
          spreadsheet sync.
        </p>
      </header>

      <div className="mb-3 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 pb-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              className="chip focus-ring"
              data-active={v.key === view ? "true" : undefined}
              onClick={() => set({ view: v.key })}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === "added" ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="chip focus-ring"
            data-active={hours === 24 ? "true" : undefined}
            onClick={() => set({ hours: 24 })}
          >
            Last 24 hours
          </button>
          <button
            type="button"
            className="chip focus-ring"
            data-active={hours !== 24 ? "true" : undefined}
            onClick={() => set({ hours: 24 * 7 })}
          >
            Last 7 days
          </button>
          <span className="text-xs text-muted-foreground">{changes.length} cards</span>
        </div>
      ) : (
        <p className="mb-5 text-xs text-muted-foreground">{changes.length} cards</p>
      )}

      {isPending ? (
        <CardGridSkeleton count={8} />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : changes.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card/50 p-6 text-center text-sm text-muted-foreground">
          {EMPTY[view]}
        </p>
      ) : (
        <div className="card-grid">
          {changes.map((change) => (
            <ChangeCard key={change.player.id + change.at} change={change} />
          ))}
        </div>
      )}
    </main>
  );
}
