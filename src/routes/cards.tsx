import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlayerCard } from "@/components/PlayerCard";
import { LoadingState, ErrorState, EmptyState } from "@/components/CardsState";
import { playerCardsQueryOptions } from "@/lib/playersQuery";

export const Route = createFileRoute("/cards")({
  head: () => ({
    meta: [
      { title: "Card Database — UFL Mobile Player Cards" },
      {
        name: "description",
        content:
          "Browse every UFL Mobile player card in the community database, with OVR, position, nation, stats and perks.",
      },
      { property: "og:title", content: "Card Database — UFL Mobile Player Cards" },
      {
        property: "og:description",
        content: "Browse every UFL Mobile player card in the community database.",
      },
    ],
  }),
  component: CardsPage,
});

function CardsPage() {
  const { data, isPending, isError, error } = useQuery(playerCardsQueryOptions);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Card Database</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${data.length} cards` : "Live from the community spreadsheet"}
          </p>
        </div>
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          ← Home
        </Link>
      </header>

      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="card-grid">
          {data.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      )}
    </main>
  );
}
