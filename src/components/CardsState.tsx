import { AlertTriangle, Inbox, SearchX, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function CardGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="card-grid" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading player cards…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton skeleton-media" />
          <div className="space-y-2 p-3">
            <div className="skeleton h-3 w-3/4 rounded" />
            <div className="skeleton h-2.5 w-1/2 rounded" />
            <div className="skeleton h-10 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadingState({ label = "Loading player cards…" }: { label?: string }) {
  return (
    <div className="surface-panel space-y-3" aria-busy="true" aria-live="polite">
      <div className="skeleton mx-auto h-3 w-40 rounded" />
      <div className="skeleton mx-auto h-3 w-64 rounded" />
      <p className="sr-only">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="surface-panel flex flex-col items-center gap-3" role="alert">
      <AlertTriangle className="size-6 text-destructive" aria-hidden />
      <h2 className="text-base font-semibold">Unable to load player cards. Please try again.</h2>
      {message ? <p className="max-w-md text-sm text-muted-foreground">{message}</p> : null}
      {onRetry ? (
        <button type="button" className="btn-primary focus-ring" onClick={onRetry}>
          <RefreshCw className="mr-1.5 size-4" aria-hidden />
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="surface-panel flex flex-col items-center gap-3">
      <Inbox className="size-6 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-semibold">No player cards found.</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        The database is synced from the source spreadsheet. Once rows are added there, cards appear
        here after the next sync.
      </p>
      <Link to="/about" className="btn-secondary focus-ring">
        How this works
      </Link>
    </div>
  );
}

export function NoResultsState({ onClear }: { onClear?: () => void }) {
  return (
    <div className="surface-panel flex flex-col items-center gap-3">
      <SearchX className="size-6 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-semibold">No matching player cards found.</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Try a different name, or remove some of the active filters.
      </p>
      {onClear ? (
        <button type="button" className="btn-primary focus-ring" onClick={onClear}>
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
