import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, ExternalLink } from "lucide-react";
import {
  getDriveSyncStatus,
  importDriveAsset,
  listDriveFiles,
  runDriveSync,
  setDriveAssetStatus,
  setDriveImportMode,
} from "@/lib/drive.functions";
import {
  DRIVE_FOLDER_TYPES,
  DRIVE_IMPORT_MODES,
  DRIVE_IMPORT_MODE_LABELS,
  DRIVE_ROOT_FOLDER,
  IMPORT_STATUS_LABELS,
  assetTypeLabel,
  formatBytes,
  type DriveImportMode,
} from "@/lib/assetTypes";

/** Google Drive asset sync dashboard: detect, approve, import, retry. */
export function DriveTab({ onChanged }: { onChanged: () => void }) {
  const statusFn = useServerFn(getDriveSyncStatus);
  const filesFn = useServerFn(listDriveFiles);
  const syncFn = useServerFn(runDriveSync);
  const modeFn = useServerFn(setDriveImportMode);
  const importFn = useServerFn(importDriveAsset);
  const statusSetFn = useServerFn(setDriveAssetStatus);

  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const status = useQuery({ queryKey: ["drive-status"], queryFn: () => statusFn(), retry: false });
  const files = useQuery({ queryKey: ["drive-files"], queryFn: () => filesFn({}), retry: false });

  const reload = async () => {
    await Promise.all([status.refetch(), files.refetch()]);
    onChanged();
  };

  const sync = async () => {
    setBusy(true);
    setNotice("Synchronizing Google Drive…");
    try {
      const result = await syncFn();
      setNotice(result.message);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Drive synchronization failed.");
    } finally {
      setBusy(false);
      await reload();
    }
  };

  const act = async (driveFileId: string, apply: boolean) => {
    setBusy(true);
    try {
      const result = await importFn({ data: { driveFileId, apply, replaceExisting: false } });
      setNotice(
        result.status === "FAILED"
          ? `Asset import failed — ${result.name}: ${result.error ?? "unknown reason"}`
          : `${result.name}: ${IMPORT_STATUS_LABELS[result.status] ?? result.status}`,
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The import failed.");
    } finally {
      setBusy(false);
      await reload();
    }
  };

  const ignore = async (driveFileId: string) => {
    await statusSetFn({ data: { driveFileId, status: "IGNORED" } });
    await reload();
  };

  const s = status.data;
  const rows = files.data ?? [];

  return (
    <div className="space-y-5">
      <section className="surface-panel">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Google Drive asset sync
        </h2>
        {status.isError ? (
          <p className="text-sm text-destructive">{(status.error as Error).message}</p>
        ) : (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="filter-label">Connection</dt>
              <dd>{s?.connected ? "Connected" : "Disconnected"}</dd>
            </div>
            <div>
              <dt className="filter-label">Last synchronization</dt>
              <dd>{s?.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : "Never"}</dd>
            </div>
            <div>
              <dt className="filter-label">Files detected</dt>
              <dd>{s?.counters.detected ?? 0}</dd>
            </div>
            <div>
              <dt className="filter-label">Imported</dt>
              <dd>{s?.counters.imported ?? 0}</dd>
            </div>
            <div>
              <dt className="filter-label">Waiting for approval</dt>
              <dd>{s?.counters.waiting ?? 0}</dd>
            </div>
            <div>
              <dt className="filter-label">Failed imports</dt>
              <dd>{s?.counters.failed ?? 0}</dd>
            </div>
            <div>
              <dt className="filter-label">Unmatched card images</dt>
              <dd>{s?.counters.unmatched ?? 0}</dd>
            </div>
            <div>
              <dt className="filter-label">Import mode</dt>
              <dd>
                <select
                  className="field focus-ring mt-1 min-h-11 w-full"
                  value={s?.importMode ?? "manual"}
                  onChange={async (e) => {
                    await modeFn({ data: { mode: e.target.value as DriveImportMode } });
                    await reload();
                  }}
                >
                  {DRIVE_IMPORT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {DRIVE_IMPORT_MODE_LABELS[m]}
                    </option>
                  ))}
                </select>
              </dd>
            </div>
          </dl>
        )}
        {s?.lastError ? <p className="mt-3 text-sm text-destructive">{s.lastError}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={busy} onClick={sync}>
            <RefreshCw className="mr-1 inline size-4" aria-hidden /> Sync now
          </button>
          <a
            className="btn-secondary inline-flex items-center"
            href={
              s?.rootFolderId
                ? `https://drive.google.com/drive/folders/${s.rootFolderId}`
                : "https://drive.google.com/drive/my-drive"
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="mr-1 inline size-4" aria-hidden /> Open Drive
          </a>
        </div>
        {notice ? <p className="mt-3 text-sm text-muted-foreground">{notice}</p> : null}
        <p className="mt-3 text-xs text-muted-foreground">
          Expected Drive layout: “{DRIVE_ROOT_FOLDER}/” with the subfolders{" "}
          {DRIVE_FOLDER_TYPES.map((f) => f.folder).join(", ")}. Each folder defines the asset
          category.
        </p>
      </section>

      <section className="surface-panel">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Detected Drive files ({rows.length})
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Drive files detected yet. Run a sync after adding images to the folders.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.driveFileId}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Google Drive → {row.folder} · {assetTypeLabel(row.type)} ·{" "}
                    {formatBytes(row.fileSize)} · {IMPORT_STATUS_LABELS[row.status] ?? row.status}
                    {row.matchGroup ? ` · ${row.matchGroup}` : ""}
                  </p>
                  {row.error ? <p className="text-xs text-destructive">{row.error}</p> : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="btn-secondary min-h-9 px-3 py-1 text-xs"
                    disabled={busy}
                    onClick={() => act(row.driveFileId, false)}
                  >
                    {row.status === "FAILED" ? "Retry" : "Import"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary min-h-9 px-3 py-1 text-xs"
                    disabled={busy}
                    onClick={() => act(row.driveFileId, true)}
                  >
                    Import &amp; use
                  </button>
                  <button
                    type="button"
                    className="btn-secondary min-h-9 px-3 py-1 text-xs"
                    disabled={busy}
                    onClick={() => ignore(row.driveFileId)}
                  >
                    Ignore
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
