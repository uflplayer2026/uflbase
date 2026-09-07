import { Loader2, AlertTriangle, Inbox, SearchX } from "lucide-react";

export function LoadingState({ label = "Loading player cards..." }: { label?: string }) {
  return (
    <div className="surface-panel flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="surface-panel flex flex-col items-center gap-3">
      <AlertTriangle className="size-6 text-destructive" aria-hidden />
      <h2 className="text-base font-semibold">Unable to load player cards. Please try again.</h2>
      {message ? <p className="max-w-md text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="surface-panel flex flex-col items-center gap-3">
      <Inbox className="size-6 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-semibold">No player cards found.</h2>
    </div>
  );
}

export function NoResultsState() {
  return (
    <div className="surface-panel flex flex-col items-center gap-3">
      <SearchX className="size-6 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-semibold">No matching player cards found.</h2>
    </div>
  );
}
