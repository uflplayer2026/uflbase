import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, ImageOff, Check, X } from "lucide-react";
import {
  assignDriveImageToCardFn,
  listDriveFiles,
  previewDriveImageFn,
} from "@/lib/drive.functions";
import { clearCardImages } from "@/lib/assets.functions";
import { cardAssetsQueryOptions } from "@/lib/assetsQuery";
import { playersSnapshotQueryOptions } from "@/lib/playersQuery";
import { variantKey } from "@/lib/cardIdentity";
import { formatBytes } from "@/lib/assetTypes";
import { CardPicker } from "@/components/CardPicker";
import type { DriveImagePreview } from "@/lib/drive.server";

/** Extracts a Drive file ID from a pasted link or a bare ID. */
export function parseDriveFileId(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const fromUrl = v.match(/\/d\/([a-zA-Z0-9_-]{10,})/) ?? v.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (fromUrl) return fromUrl[1] ?? null;
  return /^[a-zA-Z0-9_-]{10,}$/.test(v) ? v : null;
}

/**
 * Manual Drive → card assignment: pick a Drive image, pick a card, preview the
 * real image, then confirm. Nothing is ever auto-matched or guessed here.
 */
export function DriveAssignTab({ onChanged }: { onChanged: () => void }) {
  const queryClient = useQueryClient();
  const filesFn = useServerFn(listDriveFiles);
  const previewFn = useServerFn(previewDriveImageFn);
  const assignFn = useServerFn(assignDriveImageToCardFn);
  const clearFn = useServerFn(clearCardImages);

  const [fileQuery, setFileQuery] = useState("");
  const [directRef, setDirectRef] = useState("");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DriveImagePreview | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const players = useQuery(playersSnapshotQueryOptions);
  const files = useQuery({
    queryKey: ["drive-files", "assign", fileQuery],
    queryFn: () => filesFn({ data: { type: "PLAYER_CARD", q: fileQuery || undefined } }),
    retry: false,
  });

  const card = useMemo(
    () => players.data?.players.find((p) => p.id === selectedCardId) ?? null,
    [players.data, selectedCardId],
  );

  const refreshAssignments = async () => {
    await queryClient.invalidateQueries({ queryKey: cardAssetsQueryOptions.queryKey });
    onChanged();
  };

  const loadPreview = async (driveFileId: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await previewFn({ data: { driveFileId } });
      setPreview(result);
      setSelectedFileId(driveFileId);
    } catch (err) {
      setPreview(null);
      setNotice(err instanceof Error ? err.message : "The image could not be loaded.");
    } finally {
      setBusy(false);
    }
  };

  const useDirectRef = async () => {
    const id = parseDriveFileId(directRef);
    if (!id) {
      setNotice("That does not look like a Google Drive link or file ID.");
      return;
    }
    await loadPreview(id);
  };

  const confirm = async () => {
    if (!preview || !card) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await assignFn({
        data: {
          driveFileId: preview.driveFileId,
          variantKey: variantKey(card),
          replaceExisting,
        },
      });
      setNotice(
        result.assigned
          ? `Assigned “${preview.name}” to ${card.playerName || "the card"}.`
          : (result.reason ?? "The image was not assigned."),
      );
      if (result.assigned) await refreshAssignments();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The assignment failed.");
    } finally {
      setBusy(false);
    }
  };

  const removeAssignment = async () => {
    if (!card) return;
    setBusy(true);
    setNotice(null);
    try {
      await clearFn({ data: { variantKeys: [variantKey(card)] } });
      setNotice(`Removed the assigned image from ${card.playerName || "the card"}.`);
      await refreshAssignments();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The image could not be removed.");
    } finally {
      setBusy(false);
    }
  };

  const rows = files.data ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="surface-panel space-y-3 text-left">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          1. Choose a Drive image
        </h2>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={fileQuery}
            onChange={(e) => setFileQuery(e.target.value)}
            placeholder="Search detected Drive images…"
            aria-label="Search detected Drive images"
            className="field focus-ring min-h-11 w-full pl-9"
          />
        </div>
        <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {files.isError ? (
            <li className="px-1 py-2 text-sm text-destructive">
              {(files.error as Error).message}
            </li>
          ) : rows.length === 0 ? (
            <li className="px-1 py-2 text-sm text-muted-foreground">
              No Drive images found. Run a Drive sync first, or paste a file link below.
            </li>
          ) : (
            rows.map((row) => (
              <li key={row.driveFileId}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => loadPreview(row.driveFileId)}
                  data-selected={row.driveFileId === selectedFileId ? "true" : undefined}
                  className="picker-row focus-ring"
                >
                  <span className="truncate">{row.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(row.fileSize)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-border/60 pt-3">
          <label className="filter-label" htmlFor="drive-direct-ref">
            Or paste a Drive link / file ID
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="drive-direct-ref"
              type="text"
              value={directRef}
              onChange={(e) => setDirectRef(e.target.value)}
              placeholder="https://drive.google.com/file/d/…"
              className="field focus-ring min-h-11 w-full"
            />
            <button
              type="button"
              className="btn-secondary shrink-0"
              disabled={busy || !directRef.trim()}
              onClick={useDirectRef}
            >
              Load
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-5">
        <CardPicker
          label="2. Choose the card"
          players={players.data?.players ?? []}
          selectedId={selectedCardId}
          onSelect={setSelectedCardId}
          onClear={() => setSelectedCardId(null)}
        />

        <section className="surface-panel space-y-3 text-left">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            3. Preview &amp; confirm
          </h2>
          {preview ? (
            <div className="flex items-start gap-3">
              <img
                src={preview.url}
                alt={`Preview of ${preview.name}`}
                className="asset-thumb w-28 rounded-md border border-border"
              />
              <div className="min-w-0 text-sm">
                <p className="truncate font-semibold">{preview.name}</p>
                <p className="text-xs text-muted-foreground">
                  {preview.width && preview.height
                    ? `${preview.width} × ${preview.height}`
                    : "Dimensions unknown"}
                </p>
                <button
                  type="button"
                  className="chip focus-ring mt-2"
                  onClick={() => {
                    setPreview(null);
                    setSelectedFileId(null);
                  }}
                >
                  <X className="size-3.5" aria-hidden /> Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ImageOff className="size-4" aria-hidden /> Select a Drive image to preview it here.
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
            />
            Replace the card's existing image
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !preview || !card}
              onClick={confirm}
            >
              <Check className="mr-1 inline size-4" aria-hidden />
              Assign to {card ? card.playerName || "card" : "card"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || !card}
              onClick={removeAssignment}
            >
              Remove assigned image
            </button>
          </div>
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
        </section>
      </div>
    </div>
  );
}
