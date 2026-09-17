import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";
import { PlayerCard } from "@/components/PlayerCard";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CompareButton } from "@/components/CompareButton";
import { CardFilters, SORT_KEYS, type CardFilterValues } from "@/components/CardFilters";
import {
  CardGridSkeleton,
  ErrorState,
  EmptyState,
  NoResultsState,
} from "@/components/CardsState";
import { playersSnapshotQueryOptions, formatDateTime } from "@/lib/playersQuery";
import { STAT_KEYS, type PlayerCardRecord, type SortKey } from "@/lib/playerTypes";
import { STAT_LABELS } from "@/lib/statLabels";

type Search = {
  q?: string | undefined;
  position?: string | undefined;
  nation?: string | undefined;
  ovrMin?: string | undefined;
  ovrMax?: string | undefined;
  perk?: string | undefined;
  pac?: string | undefined;
  sho?: string | undefined;
  pas?: string | undefined;
  dri?: string | undefined;
  def?: string | undefined;
  phy?: string | undefined;
  sort?: SortKey | undefined;
  dir?: "asc" | "desc" | undefined;
};

const PAGE_SIZE = 60;

const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);

export const Route = createFileRoute("/cards/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: str(search["q"]),
    position: str(search["position"]),
    nation: str(search["nation"]),
    ovrMin: str(search["ovrMin"]),
    ovrMax: str(search["ovrMax"]),
    perk: str(search["perk"]),
    pac: str(search["pac"]),
    sho: str(search["sho"]),
    pas: str(search["pas"]),
    dri: str(search["dri"]),
    def: str(search["def"]),
    phy: str(search["phy"]),
    sort: SORT_KEYS.includes(search["sort"] as SortKey) ? (search["sort"] as SortKey) : undefined,
    dir: search["dir"] === "asc" ? "asc" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Card Database — UFL Mobile Player Cards" },
      {
        name: "description",
        content:
          "Search, filter and sort every UFL Mobile player card in the community database by OVR, position, nation, perk and stats.",
      },
      { property: "og:title", content: "Card Database — UFL Mobile Player Cards" },
      {
        property: "og:description",
        content: "Search, filter and sort every UFL Mobile player card in the community database.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CardsPage,
});

function compare(a: PlayerCardRecord, b: PlayerCardRecord, sort: SortKey) {
  if (sort === "playerName") return a.playerName.localeCompare(b.playerName);
  const av = a[sort];
  const bv = b[sort];
  if (av === null && bv === null) return 0;
  if (av === null) return -1;
  if (bv === null) return 1;
  return av - bv;
}

function num(value: string) {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) ? n : null;
}

function CardsPage() {
  const raw = Route.useSearch();
  const navigate = useNavigate({ from: "/cards/" });
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data, isPending, isError, error, refetch } = useQuery(playersSnapshotQueryOptions);

  const values: CardFilterValues = {
    q: raw.q ?? "",
    position: raw.position ?? "",
    nation: raw.nation ?? "",
    ovrMin: raw.ovrMin ?? "",
    ovrMax: raw.ovrMax ?? "",
    perk: raw.perk ?? "",
    pac: raw.pac ?? "",
    sho: raw.sho ?? "",
    pas: raw.pas ?? "",
    dri: raw.dri ?? "",
    def: raw.def ?? "",
    phy: raw.phy ?? "",
    sort: raw.sort ?? "ovr",
    dir: raw.dir ?? "desc",
  };

  const [searchDraft, setSearchDraft] = useState(values.q);

  const apply = (patch: Partial<CardFilterValues>) => {
    setVisible(PAGE_SIZE);
    const next = { ...values, ...patch };
    navigate({
      search: {
        q: next.q || undefined,
        position: next.position || undefined,
        nation: next.nation || undefined,
        ovrMin: next.ovrMin || undefined,
        ovrMax: next.ovrMax || undefined,
        perk: next.perk || undefined,
        pac: next.pac || undefined,
        sho: next.sho || undefined,
        pas: next.pas || undefined,
        dri: next.dri || undefined,
        def: next.def || undefined,
        phy: next.phy || undefined,
        sort: next.sort === "ovr" ? undefined : next.sort,
        dir: next.dir === "desc" ? undefined : next.dir,
      },
      replace: true,
    });
  };

  // Debounced name search: typing stays instant, the URL follows shortly after.
  useEffect(() => {
    if (searchDraft === values.q) return;
    const t = setTimeout(() => apply({ q: searchDraft }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  useEffect(() => {
    setSearchDraft(values.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.q]);

  const players = data?.players ?? [];

  const { positions, nations } = useMemo(() => {
    const p = new Set<string>();
    const n = new Set<string>();
    for (const player of players) {
      if (player.position) p.add(player.position);
      if (player.nation) n.add(player.nation);
    }
    return {
      positions: [...p].sort((a, b) => a.localeCompare(b)),
      nations: [...n].sort((a, b) => a.localeCompare(b)),
    };
  }, [players]);

  // Lowercased search index built once per synced dataset — keeps text search
  // fast even with tens of thousands of records.
  const index = useMemo(
    () => players.map((p) => ({ p, name: p.playerName.toLowerCase(), perk: p.perk.toLowerCase() })),
    [players],
  );

  const filtered = useMemo(() => {
    const q = values.q.trim().toLowerCase();
    const perk = values.perk.trim().toLowerCase();
    const ovrMin = num(values.ovrMin);
    const ovrMax = num(values.ovrMax);
    const statMins = STAT_KEYS.map((key) => [key, num(values[key])] as const).filter(
      (entry): entry is readonly [(typeof STAT_KEYS)[number], number] => entry[1] !== null,
    );

    const result: PlayerCardRecord[] = [];
    for (const entry of index) {
      const p = entry.p;
      if (q !== "" && !entry.name.includes(q)) continue;
      if (values.position !== "" && p.position !== values.position) continue;
      if (values.nation !== "" && p.nation !== values.nation) continue;
      if (perk !== "" && !entry.perk.includes(perk)) continue;
      if (ovrMin !== null && (p.ovr === null || p.ovr < ovrMin)) continue;
      if (ovrMax !== null && (p.ovr === null || p.ovr > ovrMax)) continue;
      let ok = true;
      for (const [key, min] of statMins) {
        const v = p[key];
        if (v === null || v < min) {
          ok = false;
          break;
        }
      }
      if (ok) result.push(p);
    }

    result.sort((a, b) => (values.dir === "asc" ? 1 : -1) * compare(a, b, values.sort));
    return result;
  }, [
    index,
    values.q,
    values.position,
    values.nation,
    values.perk,
    values.ovrMin,
    values.ovrMax,
    values.pac,
    values.sho,
    values.pas,
    values.dri,
    values.def,
    values.phy,
    values.sort,
    values.dir,
  ]);

  const activeFilters = useMemo(() => {
    const list: { key: keyof CardFilterValues; label: string }[] = [];
    if (values.q) list.push({ key: "q", label: `Name: ${values.q}` });
    if (values.position) list.push({ key: "position", label: `Position: ${values.position}` });
    if (values.nation) list.push({ key: "nation", label: `Nation: ${values.nation}` });
    if (values.ovrMin) list.push({ key: "ovrMin", label: `OVR ≥ ${values.ovrMin}` });
    if (values.ovrMax) list.push({ key: "ovrMax", label: `OVR ≤ ${values.ovrMax}` });
    if (values.perk) list.push({ key: "perk", label: `Perk: ${values.perk}` });
    for (const key of STAT_KEYS) {
      if (values[key]) list.push({ key, label: `${STAT_LABELS[key]} ≥ ${values[key]}` });
    }
    return list;
  }, [values]);

  const clearFilters = () => {
    setSearchDraft("");
    apply({
      q: "",
      position: "",
      nation: "",
      ovrMin: "",
      ovrMax: "",
      perk: "",
      pac: "",
      sho: "",
      pas: "",
      dri: "",
      def: "",
      phy: "",
    });
    setDrawerOpen(false);
  };

  const total = data?.cardCount ?? 0;
  const count =
    activeFilters.length > 0
      ? `${filtered.length.toLocaleString()} of ${total.toLocaleString()} cards`
      : `${total.toLocaleString()} cards`;

  const renderPanel = (idPrefix: string) => (
    <CardFilters
      idPrefix={idPrefix}
      values={values}
      positions={positions}
      nations={nations}
      searchDraft={searchDraft}
      onSearchDraft={setSearchDraft}
      onChange={apply}
      onClear={clearFilters}
      activeCount={activeFilters.length}
    />
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-4">
        <h1 className="text-2xl font-bold sm:text-3xl">Card Database</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {data ? count : "Loading cards…"}
          {data ? ` · Last synced: ${formatDateTime(data.lastSuccessAt)}` : ""}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside aria-label="Search and filters" className="hidden lg:block">
          <div className="filter-panel">{renderPanel("side-")}</div>
        </aside>

        <div>
          <div className="mb-4 flex items-center gap-2 lg:hidden">
            <button
              type="button"
              className="btn-secondary focus-ring min-h-11 flex-1"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
            >
              <SlidersHorizontal className="mr-1.5 size-4" aria-hidden />
              Search &amp; filters
              {activeFilters.length > 0 ? (
                <span className="filter-count">{activeFilters.length}</span>
              ) : null}
            </button>
          </div>

          {activeFilters.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="chip focus-ring"
                  onClick={() => {
                    if (f.key === "q") setSearchDraft("");
                    apply({ [f.key]: "" } as Partial<CardFilterValues>);
                  }}
                  aria-label={`Remove filter ${f.label}`}
                >
                  {f.label}
                  <X className="size-3.5" aria-hidden />
                </button>
              ))}
              <button type="button" className="btn-secondary focus-ring" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : null}

          {isPending ? (
            <CardGridSkeleton count={10} />
          ) : isError ? (
            <ErrorState message={(error as Error).message} onRetry={() => void refetch()} />
          ) : players.length === 0 ? (
            <EmptyState />
          ) : filtered.length === 0 ? (
            <NoResultsState onClear={clearFilters} />
          ) : (
            <>
              <p className="sr-only" aria-live="polite">
                {filtered.length} cards found
              </p>
              <div className="card-grid">
                {filtered.slice(0, visible).map((player) => (
                  <div key={player.id} className="relative">
                    <div className="card-action card-action-stack">
                      <FavoriteButton cardId={player.id} name={player.playerName} />
                      <CompareButton cardId={player.id} name={player.playerName} />
                    </div>
                    <Link
                      to="/cards/$cardId"
                      params={{ cardId: player.id }}
                      className="focus-ring block rounded-xl"
                      aria-label={`View card details for ${player.playerName || "player"}`}
                    >
                      <PlayerCard player={player} />
                    </Link>
                  </div>
                ))}
              </div>
              {visible < filtered.length ? (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    className="btn-primary focus-ring"
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  >
                    Load more ({filtered.length - visible} left)
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {drawerOpen ? (
        <div className="filter-drawer-root lg:hidden" role="dialog" aria-modal="true" aria-label="Search and filters">
          <button
            type="button"
            className="filter-drawer-backdrop"
            aria-label="Close filters"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="filter-drawer">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Search &amp; filters</h2>
              <button
                type="button"
                className="icon-btn focus-ring"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close filters"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {renderPanel("drawer-")}
            <button
              type="button"
              className="btn-primary focus-ring mt-4 w-full"
              onClick={() => setDrawerOpen(false)}
            >
              Show {filtered.length} cards
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
