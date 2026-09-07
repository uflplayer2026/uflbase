import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, RefreshCw, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminOverview, runManualSync, testSheetsConnection } from "@/lib/admin.functions";
import { formatDateTime } from "@/lib/playersQuery";
import { LoadingState } from "@/components/CardsState";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Admin Settings — UFL Mobile Player Card Database" },
      { name: "description", content: "Administration and Google Sheets synchronization settings." },
      { property: "og:title", content: "Admin Settings — UFL Mobile Player Card Database" },
      {
        property: "og:description",
        content: "Administration and Google Sheets synchronization settings.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="size-4 text-primary" aria-hidden />
      ) : (
        <XCircle className="size-4 text-destructive" aria-hidden />
      )}
      <span>{label}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const overviewFn = useServerFn(getAdminOverview);
  const syncFn = useServerFn(runManualSync);
  const testFn = useServerFn(testSheetsConnection);
  const [notice, setNotice] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overviewFn(),
    retry: false,
    refetchInterval: 30_000,
  });

  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (result) => {
      setNotice(result.message);
      overview.refetch();
      queryClient.invalidateQueries({ queryKey: ["players-snapshot"] });
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const test = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (result) => setNotice(result.message),
    onError: (err: Error) => setNotice(err.message),
  });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (overview.isPending) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12">
        <LoadingState label="Loading admin settings..." />
      </main>
    );
  }

  if (overview.isError) {
    const message = (overview.error as Error).message;
    const notAuthorized = message.toLowerCase().includes("not authorized");
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12">
        <div className="surface-panel text-center">
          <h1 className="text-lg font-semibold">
            {notAuthorized ? "Access denied. Admin only." : "Unable to load admin settings."}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" className="btn-secondary" onClick={signOut}>
              Sign out
            </button>
            <Link to="/" className="btn-secondary">
              Back to database
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const data = overview.data;
  const s = data.sync;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin settings</h1>
          <p className="mt-1 text-xs text-muted-foreground">Signed in as {data.adminEmail}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/cards" className="btn-secondary">
            View cards
          </Link>
          <button type="button" className="btn-secondary" onClick={signOut}>
            <LogOut className="mr-1 inline size-4" aria-hidden /> Sign out
          </button>
        </div>
      </header>

      <section className="surface-panel mb-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Google Sheets connection
        </h2>
        <div className="space-y-2">
          <Flag ok={data.sheets.connectorLinked} label="Google Sheets connector linked" />
          <Flag ok={data.sheets.spreadsheetConfigured} label="Spreadsheet ID configured" />
          <Flag ok={Boolean(data.sheets.sheetName)} label={`Sheet tab: ${data.sheets.sheetName}`} />
        </div>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => test.mutate()}
          disabled={test.isPending}
        >
          {test.isPending ? "Testing…" : "Test connection"}
        </button>
      </section>

      <section className="surface-panel mb-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Synchronization
          </h2>
          <button
            type="button"
            className="btn-primary"
            onClick={() => sync.mutate()}
            disabled={sync.isPending || s.syncing}
          >
            <RefreshCw
              className={`mr-1 inline size-4 ${sync.isPending ? "animate-spin" : ""}`}
              aria-hidden
            />
            {sync.isPending ? "Syncing…" : "Sync Now"}
          </button>
        </div>
        <Row label="Auto sync" value={`Every ${s.intervalMinutes} minutes`} />
        <Row label="Last successful sync" value={formatDateTime(s.lastSuccessAt)} />
        <Row label="Last attempt" value={formatDateTime(s.lastAttemptAt)} />
        <Row label="Next scheduled sync" value={formatDateTime(s.nextSyncAt)} />
        <Row label="Status" value={s.lastStatus ?? "Never run"} />
        <Row label="Duration" value={s.lastDurationMs === null ? "—" : `${s.lastDurationMs} ms`} />
        <Row label="Cards cached" value={String(s.cardCount)} />
        <Row label="Currently running" value={s.syncing ? "Yes" : "No"} />
        {s.lastError ? (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Last error: {s.lastError}
          </p>
        ) : null}
        {notice ? <p className="mt-3 text-sm text-muted-foreground">{notice}</p> : null}
      </section>

      <p className="text-xs text-muted-foreground">
        Google Sheets remains the single source of truth. Cards are never edited here — update the
        spreadsheet and sync.
      </p>
    </main>
  );
}
