import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, Upload, Link2, ImagePlus, RefreshCw } from "lucide-react";
import {
  addUrlAsset,
  applyCardBackground,
  assignCardImages,
  getAssetLibrary,
  removeAsset,
  replaceAsset,
  updateAsset,
  uploadAsset,
} from "@/lib/assets.functions";
import {
  ASSET_TYPES,
  UPLOAD_ACCEPT,
  assetTypeLabel,
  ASSET_SOURCE_LABELS,
  formatBytes,
  formatDimensions,
  isHttpUrl,
  type AssetRecord,
  type AssetType,
} from "@/lib/assetTypes";
import { matchFileName, type MatchResult } from "@/lib/assetMatching";
import { playersSnapshotQueryOptions } from "@/lib/playersQuery";
import { useCardAssetMap } from "@/lib/assetsQuery";
import { variantKey } from "@/lib/cardIdentity";
import { LoadingState } from "@/components/CardsState";
import type { PlayerCardRecord } from "@/lib/playerTypes";
import { CardTypesTab } from "@/components/admin/CardTypesTab";
import { DriveTab } from "@/components/admin/DriveTab";
import { DriveAssignTab } from "@/components/admin/DriveAssignTab";
import { CompositionEditor } from "@/components/admin/CompositionEditor";

export const Route = createFileRoute("/_authenticated/assets")({
  head: () => ({
    meta: [
      { title: "Asset Manager — UFL Mobile Player Card Database" },
      { name: "description", content: "Central image and asset management for UFLBase." },
      { property: "og:title", content: "Asset Manager — UFL Mobile Player Card Database" },
      { property: "og:description", content: "Central image and asset management for UFLBase." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssetManagerPage,
});

const TABS = [
  { id: "library", label: "Library" },
  { id: "cards", label: "Card images" },
  { id: "backgrounds", label: "Backgrounds" },
  { id: "cardtypes", label: "Card types" },
  { id: "drive", label: "Google Drive" },
  { id: "assign", label: "Assign image" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function AssetManagerPage() {
  const [tab, setTab] = useState<TabId>("library");
  const queryClient = useQueryClient();
  const libraryFn = useServerFn(getAssetLibrary);
  const snapshot = useQuery(playersSnapshotQueryOptions);

  const [typeFilter, setTypeFilter] = useState<AssetType | "">("");
  const [search, setSearch] = useState("");

  const library = useQuery({
    queryKey: ["asset-library", typeFilter, search],
    queryFn: () =>
      libraryFn({
        data: {
          ...(typeFilter ? { type: typeFilter } : {}),
          ...(search.trim() ? { q: search.trim() } : {}),
        },
      }),
    retry: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["asset-library"] });
    queryClient.invalidateQueries({ queryKey: ["card-assets"] });
    queryClient.invalidateQueries({ queryKey: ["card-type-backgrounds"] });
  };

  if (library.isPending) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-12">
        <LoadingState label="Loading asset manager…" />
      </main>
    );
  }

  if (library.isError) {
    const message = (library.error as Error).message;
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12">
        <div className="surface-panel text-center">
          <h1 className="text-lg font-semibold">
            {message.toLowerCase().includes("not authorized")
              ? "Access denied. Admin only."
              : "Unable to load the asset manager."}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <Link to="/" className="btn-secondary mt-4 inline-flex">
            Back to database
          </Link>
        </div>
      </main>
    );
  }

  const assets = library.data;
  const players = snapshot.data?.players ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Asset manager</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {assets.length} assets · card images and backgrounds stay separate
          </p>
        </div>
        <Link to="/settings" className="btn-secondary">
          Admin settings
        </Link>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={t.id === tab ? "btn-primary" : "btn-secondary"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "library" ? (
        <LibraryTab
          assets={assets}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          search={search}
          setSearch={setSearch}
          onChanged={refresh}
        />
      ) : tab === "cards" ? (
        <CardImagesTab players={players} onChanged={refresh} />
      ) : tab === "backgrounds" ? (
        <BackgroundsTab players={players} assets={assets} onChanged={refresh} />
      ) : tab === "cardtypes" ? (
        <CardTypesTab assets={assets} players={players} onChanged={refresh} />
      ) : (
        <DriveTab onChanged={refresh} />
      )}
    </main>
  );
}

/* --------------------------------- library --------------------------------- */

function LibraryTab({
  assets,
  typeFilter,
  setTypeFilter,
  search,
  setSearch,
  onChanged,
}: {
  assets: AssetRecord[];
  typeFilter: AssetType | "";
  setTypeFilter: (v: AssetType | "") => void;
  search: string;
  setSearch: (v: string) => void;
  onChanged: () => void;
}) {
  const uploadFn = useServerFn(uploadAsset);
  const urlFn = useServerFn(addUrlAsset);
  const updateFn = useServerFn(updateAsset);
  const replaceFn = useServerFn(replaceAsset);
  const removeFn = useServerFn(removeAsset);

  const [uploadType, setUploadType] = useState<AssetType>("PLAYER_CARD");
  const [urlValue, setUrlValue] = useState("");
  const [urlMode, setUrlMode] = useState<"external" | "import">("import");
  const [bulkUrls, setBulkUrls] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    let ok = 0;
    const failures: string[] = [];
    for (let i = 0; i < list.length; i += 1) {
      const file = list[i]!;
      setProgress(`Uploading ${i + 1} / ${list.length}`);
      try {
        await uploadFn({
          data: { name: file.name, type: uploadType, base64: await fileToBase64(file) },
        });
        ok += 1;
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }
    setProgress(null);
    setNotice(
      `${ok} uploaded${failures.length ? `, ${failures.length} failed — ${failures[0]}` : ""}.`,
    );
    onChanged();
  };

  const addSingleUrl = async () => {
    if (!isHttpUrl(urlValue)) {
      setNotice("That is not a valid image URL.");
      return;
    }
    try {
      await urlFn({ data: { type: uploadType, url: urlValue.trim(), mode: urlMode } });
      setUrlValue("");
      setNotice(urlMode === "import" ? "Imported into UFLBase storage." : "External URL added.");
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The URL could not be added.");
    }
  };

  const importBulkUrls = async () => {
    const lines = bulkUrls
      .split(/\s+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const invalid = lines.filter((l) => !isHttpUrl(l));
    const valid = lines.filter((l) => isHttpUrl(l));
    let imported = 0;
    const failed: string[] = [];
    for (let i = 0; i < valid.length; i += 1) {
      setProgress(`Importing ${i + 1} / ${valid.length}`);
      try {
        await urlFn({ data: { type: uploadType, url: valid[i]!, mode: urlMode } });
        imported += 1;
      } catch {
        failed.push(valid[i]!);
      }
    }
    setProgress(null);
    setNotice(`${imported} imported · ${failed.length} failed · ${invalid.length} invalid.`);
    setBulkUrls("");
    onChanged();
  };

  return (
    <div className="space-y-5">
      <section className="surface-panel">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Add assets
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="filter-label">Asset type</span>
            <select
              className="field focus-ring mt-1 min-h-11 w-full"
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as AssetType)}
            >
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {assetTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="filter-label">Upload files</span>
            <input
              type="file"
              multiple
              accept={UPLOAD_ACCEPT}
              className="field focus-ring mt-1 min-h-11 w-full"
              onChange={(e) => uploadFiles(e.target.files)}
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="block text-sm">
            <span className="filter-label">Image URL</span>
            <input
              className="field focus-ring mt-1 min-h-11 w-full"
              placeholder="https://example.com/card.png"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="filter-label">Mode</span>
            <select
              className="field focus-ring mt-1 min-h-11 w-full"
              value={urlMode}
              onChange={(e) => setUrlMode(e.target.value as "external" | "import")}
            >
              <option value="import">Import into UFLBase</option>
              <option value="external">Keep external URL</option>
            </select>
          </label>
          <button type="button" className="btn-secondary mt-6 h-11" onClick={addSingleUrl}>
            <Link2 className="mr-1 inline size-4" aria-hidden /> Add
          </button>
        </div>

        <label className="mt-3 block text-sm">
          <span className="filter-label">Bulk URL import (one per line)</span>
          <textarea
            className="field focus-ring mt-1 h-24 w-full"
            value={bulkUrls}
            onChange={(e) => setBulkUrls(e.target.value)}
            placeholder={"https://example.com/messi.png\nhttps://example.com/mbappe.webp"}
          />
        </label>
        <button
          type="button"
          className="btn-secondary mt-2"
          onClick={importBulkUrls}
          disabled={!bulkUrls.trim()}
        >
          <ImagePlus className="mr-1 inline size-4" aria-hidden /> Process URLs
        </button>

        {progress ? <p className="mt-3 text-sm font-semibold">{progress}</p> : null}
        {notice ? <p className="mt-2 text-sm text-muted-foreground">{notice}</p> : null}
      </section>

      <section className="surface-panel">
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="filter-label">Search</span>
            <input
              className="field focus-ring mt-1 min-h-11 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Asset name"
            />
          </label>
          <label className="block text-sm">
            <span className="filter-label">Filter by type</span>
            <select
              className="field focus-ring mt-1 min-h-11 w-full"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as AssetType | "")}
            >
              <option value="">All types</option>
              {ASSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {assetTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {assets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No assets yet.</p>
        ) : (
          <div className="asset-grid">
            {assets.map((asset) => (
              <div key={asset.id} className="asset-tile">
                <img className="asset-thumb" src={asset.url} alt={asset.name} loading="lazy" />
                <div className="space-y-1 p-2 text-[11px]">
                  <p className="truncate font-semibold" title={asset.name}>
                    {asset.name}
                  </p>
                  <p className="text-muted-foreground">{assetTypeLabel(asset.type)}</p>
                  <p className="text-muted-foreground">
                    {ASSET_SOURCE_LABELS[asset.source]} · {formatBytes(asset.fileSize)}
                  </p>
                  <p className="text-muted-foreground">
                    {formatDimensions(asset.width, asset.height)} · used {asset.usageCount}×
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(asset.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <button
                      type="button"
                      className="btn-secondary min-h-8 px-2 py-1 text-[11px]"
                      onClick={async () => {
                        const name = window.prompt("Asset name", asset.name);
                        if (!name) return;
                        await updateFn({ data: { id: asset.id, name } });
                        onChanged();
                      }}
                    >
                      Rename
                    </button>
                    <label className="btn-secondary min-h-8 cursor-pointer px-2 py-1 text-[11px]">
                      Replace
                      <input
                        type="file"
                        accept={UPLOAD_ACCEPT}
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          await replaceFn({
                            data: { id: asset.id, base64: await fileToBase64(file) },
                          });
                          onChanged();
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-secondary min-h-8 px-2 py-1 text-[11px]"
                      onClick={async () => {
                        if (!window.confirm(`Delete “${asset.name}”? This cannot be undone.`))
                          return;
                        await removeFn({ data: { id: asset.id } });
                        onChanged();
                      }}
                    >
                      <Trash2 className="size-3" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------- card images ------------------------------- */

type PendingUpload = { asset: AssetRecord; match: MatchResult };

function CardImagesTab({
  players,
  onChanged,
}: {
  players: PlayerCardRecord[];
  onChanged: () => void;
}) {
  const uploadFn = useServerFn(uploadAsset);
  const assignFn = useServerFn(assignCardImages);
  const assetMap = useCardAssetMap();

  const [replaceExisting, setReplaceExisting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [review, setReview] = useState<PendingUpload[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const reviewQueue: PendingUpload[] = [];
    const unmatchedNames: string[] = [];
    const failures: string[] = [];
    const autoEntries: { variantKey: string; assetId: string }[] = [];

    for (let i = 0; i < list.length; i += 1) {
      const file = list[i]!;
      setProgress(`Uploading ${i + 1} / ${list.length}`);
      let asset: AssetRecord;
      try {
        asset = await uploadFn({
          data: { name: file.name, type: "PLAYER_CARD", base64: await fileToBase64(file) },
        });
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof Error ? err.message : "failed"}`);
        continue;
      }
      const match = matchFileName(file.name, players);
      if (match.group === "matched" && match.candidates[0]) {
        autoEntries.push({
          variantKey: variantKey(match.candidates[0].player),
          assetId: asset.id,
        });
      } else if (match.group === "review") {
        reviewQueue.push({ asset, match });
      } else {
        unmatchedNames.push(file.name);
      }
    }

    let assigned = 0;
    let skipped = 0;
    if (autoEntries.length > 0) {
      setProgress("Assigning matched images…");
      const result = await assignFn({ data: { entries: autoEntries, replaceExisting } });
      assigned = result.assigned;
      skipped = result.skipped;
    }

    setProgress(null);
    setReview(reviewQueue);
    setUnmatched(unmatchedNames);
    setFailed(failures);
    setNotice(
      `${assigned} matched and assigned · ${reviewQueue.length} needs review · ${unmatchedNames.length} unmatched${
        skipped ? ` · ${skipped} skipped (already had an image)` : ""
      }${failures.length ? ` · ${failures.length} invalid files` : ""}`,
    );
    onChanged();
  };

  const confirmMatch = async (item: PendingUpload, player: PlayerCardRecord) => {
    await assignFn({
      data: {
        entries: [{ variantKey: variantKey(player), assetId: item.asset.id }],
        replaceExisting: true,
      },
    });
    setReview((prev) => prev.filter((r) => r.asset.id !== item.asset.id));
    onChanged();
  };

  return (
    <div className="space-y-5">
      <section className="surface-panel">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Bulk card image upload
        </h2>
        <label className="block text-sm">
          <span className="filter-label">Select many images at once</span>
          <input
            type="file"
            multiple
            accept={UPLOAD_ACCEPT}
            className="field focus-ring mt-1 min-h-11 w-full"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => {
              if (
                e.target.checked &&
                !window.confirm("Replace card images that already exist? This overwrites them.")
              )
                return;
              setReplaceExisting(e.target.checked);
            }}
          />
          Replace existing images (default: cards that already have an image are skipped)
        </label>
        {progress ? <p className="mt-3 text-sm font-semibold">{progress}</p> : null}
        {notice ? <p className="mt-2 text-sm text-muted-foreground">{notice}</p> : null}
        {failed.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-destructive">
            {failed.slice(0, 5).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="surface-panel">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Needs review ({review.length})
        </h2>
        {review.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing needs review.</p>
        ) : (
          <ul className="space-y-4">
            {review.map((item) => (
              <li key={item.asset.id} className="border-b border-border/60 pb-4 last:border-0">
                <div className="flex flex-wrap items-start gap-3">
                  <img
                    src={item.asset.url}
                    alt={item.asset.name}
                    className="size-20 rounded object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.match.fileName}</p>
                    <div className="mt-2 space-y-2">
                      {item.match.candidates.map((c) => {
                        const has = assetMap.get(variantKey(c.player))?.cardImage;
                        return (
                          <div
                            key={c.player.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <span>
                              {c.player.playerName} · {c.player.ovr ?? "—"} ·{" "}
                              {c.player.position || "—"}
                              {has ? " · has image" : ""}
                            </span>
                            <button
                              type="button"
                              className="btn-secondary min-h-9 px-3 py-1 text-xs"
                              onClick={() => confirmMatch(item, c.player)}
                            >
                              Confirm match
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="btn-secondary mt-2 min-h-9 px-3 py-1 text-xs"
                      onClick={() =>
                        setReview((prev) => prev.filter((r) => r.asset.id !== item.asset.id))
                      }
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface-panel">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Unmatched ({unmatched.length})
        </h2>
        {unmatched.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unmatched images.</p>
        ) : (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {unmatched.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ------------------------------- backgrounds ------------------------------- */

function BackgroundsTab({
  players,
  assets,
  onChanged,
}: {
  players: PlayerCardRecord[];
  assets: AssetRecord[];
  onChanged: () => void;
}) {
  const applyFn = useServerFn(applyCardBackground);
  const assetMap = useCardAssetMap();
  const backgrounds = assets.filter((a) => a.type === "CARD_BACKGROUND");

  const [selected, setSelected] = useState<string>("");
  const [position, setPosition] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [scope, setScope] = useState<"filtered" | "missing">("filtered");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const positions = useMemo(
    () => [...new Set(players.map((p) => p.position).filter(Boolean))].sort(),
    [players],
  );

  const targets = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    return players.filter((p) => {
      if (position && p.position !== position) return false;
      if (q && !p.playerName.toLowerCase().includes(q)) return false;
      if (scope === "missing" && assetMap.get(variantKey(p))?.background) return false;
      return true;
    });
  }, [players, position, nameQuery, scope, assetMap]);

  const run = async (assetId: string | null) => {
    if (targets.length === 0) return;
    const verb = assetId ? "Apply" : "Remove";
    if (!window.confirm(`${verb} background on ${targets.length} cards?`)) return;
    setBusy(true);
    try {
      const keys = [...new Set(targets.map((p) => variantKey(p)))];
      const result = await applyFn({ data: { variantKeys: keys, assetId } });
      setNotice(
        assetId
          ? `Background applied to ${result.applied} cards.`
          : `Background removed from ${result.applied} cards.`,
      );
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The operation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="surface-panel">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Background library ({backgrounds.length})
        </h2>
        {backgrounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Upload an image with the type “Card background” in the Library tab first.
          </p>
        ) : (
          <div className="asset-grid">
            {backgrounds.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setSelected(bg.id)}
                className={`asset-tile text-left ${selected === bg.id ? "ring-2 ring-primary" : ""}`}
              >
                <img className="asset-thumb" src={bg.url} alt={bg.name} loading="lazy" />
                <p className="truncate p-2 text-[11px] font-semibold">{bg.name}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="surface-panel">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Apply to cards
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="filter-label">Position</span>
            <select
              className="field focus-ring mt-1 min-h-11 w-full"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            >
              <option value="">All positions</option>
              {positions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="filter-label">Player name contains</span>
            <input
              className="field focus-ring mt-1 min-h-11 w-full"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="filter-label">Scope</span>
            <select
              className="field focus-ring mt-1 min-h-11 w-full"
              value={scope}
              onChange={(e) => setScope(e.target.value as "filtered" | "missing")}
            >
              <option value="filtered">All matching cards</option>
              <option value="missing">Only cards without a background</option>
            </select>
          </label>
        </div>

        <p className="mt-3 text-sm font-semibold">{targets.length} cards affected</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!selected || busy || targets.length === 0}
            onClick={() => run(selected)}
          >
            <Upload className="mr-1 inline size-4" aria-hidden /> Apply background
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || targets.length === 0}
            onClick={() => run(null)}
          >
            <RefreshCw className="mr-1 inline size-4" aria-hidden /> Remove background
          </button>
        </div>
        {notice ? <p className="mt-3 text-sm text-muted-foreground">{notice}</p> : null}
      </section>

      <CompositionEditor
        backgrounds={backgrounds}
        cardImages={assets.filter((a) => a.type === "PLAYER_CARD")}
        onChanged={onChanged}
      />
    </div>
  );
}
