import { Loader2, AlertTriangle, Inbox } from "lucide-react";

export function LoadingState({ label = "Loading player cards…" }: { label?: string }) {
  return (
    <div className="surface-panel flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="surface-panel flex flex-col items-center gap-3">
      <AlertTriangle className="size-6 text-destructive" aria-hidden />
      <h2 className="text-base font-semibold">Player data could not be loaded</h2>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="surface-panel flex flex-col items-center gap-3">
      <Inbox className="size-6 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-semibold">No player cards yet</h2>
      <p className="text-sm text-muted-foreground">
        The connected spreadsheet currently has no card rows.
      </p>
    </div>
  );
}
