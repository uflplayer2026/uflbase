import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { PlayerCard } from "@/components/PlayerCard";
import { LoadingState, ErrorState } from "@/components/CardsState";
import { playersSnapshotQueryOptions } from "@/lib/playersQuery";
import { STAT_KEYS } from "@/lib/playerTypes";
import { STAT_LABELS } from "@/lib/statLabels";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareCardButton } from "@/components/ShareCardButton";
import { CompareButton } from "@/components/CompareButton";

export const Route = createFileRoute("/cards/$cardId")({
  head: () => ({
    meta: [
      { title: "Player Card — UFL Mobile Player Card Database" },
      { name: "description", content: "Full stats, perk and rating for a UFL Mobile player card." },
      { property: "og:title", content: "Player Card — UFL Mobile Player Card Database" },
      {
        property: "og:description",
        content: "Full stats, perk and rating for a UFL Mobile player card.",
      },
    ],
  }),
  component: CardDetail,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

/** A Drive Link is only actionable when it is a usable web URL. */
function validDriveLink(value: string): string | null {
  const v = value.trim();
  return /^https?:\/\/\S+$/i.test(v) ? v : null;
}

function CardDetail() {
  const { cardId } = Route.useParams();
  const { data, isPending, isError, error } = useQuery(playersSnapshotQueryOptions);
  const player = data?.players.find((p) => p.id === cardId);
  const driveLink = player ? validDriveLink(player.driveLink) : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:py-10">
      <Link
        to="/cards"
        className="focus-ring mb-5 inline-flex min-h-11 items-center gap-1 rounded text-sm font-medium text-accent hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden /> Back to cards
      </Link>

      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : !player ? (
        <div className="surface-panel">
          <h1 className="text-base font-semibold">No player cards found.</h1>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-[minmax(0,220px)_1fr]">
          <div>
            <PlayerCard player={player} />
          </div>
          <div className="surface-panel text-left">
            <h1 className="text-xl font-bold break-words">{player.playerName || "—"}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <FavoriteButton cardId={player.id} name={player.playerName} />
              <CompareButton cardId={player.id} name={player.playerName} withLabel />
              <ShareCardButton player={player} />
            </div>
            <div className="mt-4">
              <Row label="OVR" value={player.ovr === null ? "—" : String(player.ovr)} />
              <Row label="Position" value={player.position || "—"} />
              <Row label="Nation" value={player.nation || "—"} />
              {STAT_KEYS.map((key) => (
                <Row
                  key={key}
                  label={STAT_LABELS[key]}
                  value={player[key] === null ? "—" : String(player[key])}
                />
              ))}

              <Row label="Perk" value={player.perk || "—"} />
              {driveLink ? (
                <div className="flex items-center justify-between py-2 text-sm">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    Source
                  </span>
                  <a
                    href={driveLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring inline-flex min-h-11 items-center gap-1 rounded font-medium text-accent hover:underline"
                  >
                    Open Drive File
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
