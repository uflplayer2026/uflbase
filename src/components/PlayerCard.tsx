import { memo } from "react";
import { ImageOff } from "lucide-react";
import type { PlayerCardRecord } from "@/lib/playerTypes";
import { STAT_KEYS } from "@/lib/playerTypes";
import { STAT_LABELS } from "@/lib/statLabels";


function StatValue({ value }: { value: number | null }) {
  return <span className="stat-value">{value === null ? "—" : value}</span>;
}

/** The single reusable card presentation used on every page. */
function PlayerCardBase({ player }: { player: PlayerCardRecord }) {
  const name = player.playerName || "Unknown player";
  return (
    <article className="player-card">
      <div className="player-card-media">
        {player.cardImage ? (
          <img
            src={player.cardImage}
            alt={`${name} — ${player.position || "player"} card${
              player.ovr === null ? "" : `, ${player.ovr} overall`
            }`}
            loading="lazy"
            decoding="async"
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
              <dt className="stat-label">{STAT_LABELS[key]}</dt>
              <dd>
                <StatValue value={player[key]} />
              </dd>
            </div>
          ))}
        </dl>

        {player.perk ? <p className="player-card-perk">{player.perk}</p> : null}
      </div>
    </article>
  );
}

export const PlayerCard = memo(PlayerCardBase);
