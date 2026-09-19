import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import type { PlayerCardRecord } from "@/lib/playerTypes";
import { STAT_LABELS } from "@/lib/statLabels";
import { STAT_KEYS } from "@/lib/playerTypes";

function shareText(player: PlayerCardRecord) {
  const stats = STAT_KEYS.map((k) => `${STAT_LABELS[k]} ${player[k] ?? "—"}`).join(" · ");
  return [
    `${player.playerName || "Unknown player"} — ${player.ovr ?? "—"} OVR ${player.position || ""}`.trim(),
    [player.nation, player.perk].filter(Boolean).join(" · "),
    stats,
    "via UFLBase",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Shares real synced card data. Uses the native share sheet when available. */
export function ShareCardButton({
  player,
  className = "",
}: {
  player: PlayerCardRecord;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const onShare = async () => {
    const url =
      typeof window === "undefined"
        ? ""
        : `${window.location.origin}/cards/${encodeURIComponent(player.id)}`;
    const text = shareText(player);
    const title = `${player.playerName || "Player card"} — UFLBase`;

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setState("failed");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      <button type="button" className="btn-secondary focus-ring" onClick={() => void onShare()}>
        {state === "copied" ? (
          <Check className="mr-1.5 inline size-4" aria-hidden />
        ) : (
          <Share2 className="mr-1.5 inline size-4" aria-hidden />
        )}
        {state === "copied" ? "Link copied" : "Share card"}
      </button>
      {state === "failed" ? (
        <span className="text-xs text-destructive">Sharing isn’t available in this browser.</span>
      ) : null}
    </div>
  );
}
