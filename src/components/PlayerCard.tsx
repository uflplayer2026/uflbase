import { ImageOff } from "lucide-react";
import type { PlayerCardRecord } from "@/lib/players.functions";

const STAT_KEYS = ["pac", "sho", "pas", "dri", "def", "phy"] as const;

function StatValue({ value }: { value: number | null }) {
  return <span className="stat-value">{value === null ? "—" : value}</span>;
}

export function PlayerCard({ player }: { player: PlayerCardRecord }) {
  return (
    <article className="player-card">
      <div className="player-card-media">
        {player.cardImage ? (
          <img
            src={player.cardImage}
            alt={player.playerName || "Player card"}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="player-card-placeholder">
            <ImageOff className="size-6" aria-hidden />
            <span className="text-[10px] uppercase tracking-widest">No image</span>
          </div>
        )}

        <div className="player-card-badge">
          <strong className="text-lg leading-none">{player.ovr === null ? "—" : player.ovr}</strong>
          <span className="text-[10px] uppercase tracking-widest opacity-80">
            {player.position || "—"}
          </span>
        </div>
      </div>

      <div className="player-card-body">
        <h3 className="player-card-name">{player.playerName || "—"}</h3>
        <p className="player-card-nation">{player.nation || "—"}</p>

        <dl className="player-card-stats">
          {STAT_KEYS.map((key) => (
            <div key={key} className="stat">
              <dt className="stat-label">{key.toUpperCase()}</dt>
              <dd>
                <StatValue value={player[key]} />
              </dd>
            </div>
          ))}
        </dl>

        <p className="player-card-perk">{player.perk || "—"}</p>
      </div>
    </article>
  );
}
