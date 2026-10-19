import { memo, useState } from "react";
import { ImageOff } from "lucide-react";
import type { PlayerCardRecord } from "@/lib/playerTypes";
import { STAT_KEYS } from "@/lib/playerTypes";
import { STAT_LABELS } from "@/lib/statLabels";
import { useCardAssetMap, useCardTypeMap, resolveCardArt } from "@/lib/assetsQuery";
import { compositionStyle } from "@/lib/cardComposition";

function StatValue({ value }: { value: number | null }) {
  return <span className="stat-value">{value === null ? "—" : value}</span>;
}

/** The single reusable card presentation used on every page. */
function PlayerCardBase({ player }: { player: PlayerCardRecord }) {
  const name = player.playerName || "Unknown player";
  // Card image and background are separate assets and are resolved separately.
  const art = resolveCardArt(player, useCardAssetMap(), useCardTypeMap());
  // Broken or unreachable image URLs fall back to the clean placeholder.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = art.imageUrl && art.imageUrl !== failedUrl ? art.imageUrl : null;

  return (
    <article className="player-card">
      <div className="player-card-media">
        {art.backgroundUrl ? (
          <img
            src={art.backgroundUrl}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="player-card-background"
          />
        ) : null}

        {imageUrl ? (
          art.imageKind === "portrait" ? (
            // Player portrait: cover the artwork region, anchored towards the top
            // so the face is never cut off. Aspect ratio is always preserved.
            <img
              src={imageUrl}
              alt={`${name} — ${player.position || "player"} portrait${
                player.ovr === null ? "" : `, ${player.ovr} overall`
              }`}
              loading="lazy"
              decoding="async"
              className="player-card-image player-card-portrait"
              onError={() => setFailedUrl(imageUrl)}
            />
          ) : (
            // Complete card image: layered composition inside the background's
            // safe area, aspect ratio preserved, never cropped, never overflowing.
            <img
              src={imageUrl}
              alt={`${name} — ${player.position || "player"} card${
                player.ovr === null ? "" : `, ${player.ovr} overall`
              }`}
              loading="lazy"
              decoding="async"
              className="player-card-image"
              style={
                art.backgroundUrl
                  ? compositionStyle(art.composition)
                  : { position: "relative", height: "100%", width: "100%", objectFit: "contain" }
              }
              onError={() => setFailedUrl(imageUrl)}
            />
          )
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
