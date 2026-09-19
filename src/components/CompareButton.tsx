import { Link } from "@tanstack/react-router";
import { GitCompareArrows } from "lucide-react";

/**
 * Sends a card into the existing Compare page as slot A. The Compare engine
 * itself is untouched — this only pre-fills its URL state.
 */
export function CompareButton({
  cardId,
  name,
  className = "",
  withLabel = false,
}: {
  cardId: string;
  name: string;
  className?: string;
  withLabel?: boolean;
}) {
  const label = `Compare ${name || "this card"}`;
  return (
    <Link
      to="/compare"
      search={{ a: cardId }}
      className={
        withLabel ? `btn-secondary focus-ring ${className}` : `icon-btn focus-ring ${className}`
      }
      aria-label={label}
      title={label}
      onClick={(e) => e.stopPropagation()}
    >
      <GitCompareArrows className="size-4" aria-hidden />
      {withLabel ? <span className="ml-1.5">Compare</span> : null}
    </Link>
  );
}
