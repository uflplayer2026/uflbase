import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { PlayerCard } from "@/components/PlayerCard";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CardGridSkeleton, ErrorState, EmptyState } from "@/components/CardsState";
import { playersSnapshotQueryOptions } from "@/lib/playersQuery";
import { useFavorites } from "@/hooks/useFavorites";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Favorites — UFLBase Player Cards" },
      {
        name: "description",
        content:
          "Your saved UFL Mobile player cards, kept on this device and always showing the latest synced spreadsheet data.",
      },
      { property: "og:title", content: "Favorites — UFLBase Player Cards" },
      {
        property: "og:description",
        content: "Your saved UFL Mobile player cards with live synced ratings and stats.",
      },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { ids, clear } = useFavorites();
  const { data, isPending, isError, error, refetch } = useQuery(playersSnapshotQueryOptions);
  const players = data?.players ?? [];

  const favorites = useMemo(() => {
    const set = new Set(ids);
    return players.filter((p) => set.has(p.id));
  }, [players, ids]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">Favorites</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved on this device · {favorites.length} card{favorites.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/cards" className="btn-secondary focus-ring">
            Back to database
          </Link>
          {favorites.length > 0 ? (
            <button type="button" className="btn-secondary focus-ring" onClick={clear}>
              Clear all
            </button>
          ) : null}
        </div>
      </header>

      {isPending ? (
        <CardGridSkeleton count={6} />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
      ) : players.length === 0 ? (
        <EmptyState />
      ) : favorites.length === 0 ? (
        <div className="surface-panel flex flex-col items-center gap-3">
          <Heart className="size-6 text-muted-foreground" aria-hidden />
          <h2 className="text-base font-semibold">No favorites yet.</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Tap the heart on any card to save it here. Favorites stay in this browser and never
            change the source spreadsheet.
          </p>
          <Link to="/cards" className="btn-primary focus-ring">
            Browse cards
          </Link>
        </div>
      ) : (
        <div className="card-grid">
          {favorites.map((player) => (
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
      )}
    </main>
  );
}
