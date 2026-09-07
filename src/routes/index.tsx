import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlayerCard } from "@/components/PlayerCard";
import { LoadingState, ErrorState, EmptyState } from "@/components/CardsState";
import { playerCardsQueryOptions } from "@/lib/playersQuery";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UFL Mobile Player Card Database" },
      {
        name: "description",
        content: "Community-made UFL Mobile player card database with full stats, perks and ratings.",
      },
      { property: "og:title", content: "UFL Mobile Player Card Database" },
      {
        property: "og:description",
        content: "Community-made UFL Mobile player card database.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { data, isPending, isError, error } = useQuery(playerCardsQueryOptions);
  const featured = data?.slice(0, 8) ?? [];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:py-16">
      <section className="mb-10 text-center">
        <span className="inline-block rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Community project
        </span>
        <h1 className="mt-4 text-3xl font-bold sm:text-5xl">UFL Mobile Player Card Database</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Community-made UFL Mobile player card database.
        </p>
        <Link
          to="/cards"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Browse all cards
        </Link>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Latest cards</h2>
        {isPending ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message={(error as Error).message} />
        ) : featured.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="card-grid">
            {featured.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
