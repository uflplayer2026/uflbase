import { Heart } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";

export function FavoriteButton({
  cardId,
  name,
  className = "",
}: {
  cardId: string;
  name: string;
  className?: string;
}) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(cardId);
  const label = `${active ? "Remove" : "Add"} ${name || "this card"} ${active ? "from" : "to"} favorites`;

  return (
    <button
      type="button"
      className={`icon-btn focus-ring ${className}`}
      data-active={active ? "true" : undefined}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(cardId);
      }}
    >
      <Heart className="size-4" aria-hidden fill={active ? "currentColor" : "none"} />
    </button>
  );
}
