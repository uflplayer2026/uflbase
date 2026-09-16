import { Search } from "lucide-react";
import { STAT_KEYS } from "@/lib/playerTypes";
import { STAT_LABELS, SORT_LABELS } from "@/lib/statLabels";
import type { SortKey } from "@/lib/playerTypes";

export type CardFilterValues = {
  q: string;
  position: string;
  nation: string;
  ovrMin: string;
  ovrMax: string;
  perk: string;
  pac: string;
  sho: string;
  pas: string;
  dri: string;
  def: string;
  phy: string;
  sort: SortKey;
  dir: "asc" | "desc";
};

export const SORT_KEYS: SortKey[] = [
  "ovr",
  "playerName",
  "pac",
  "sho",
  "pas",
  "dri",
  "def",
  "phy",
];

/**
 * Presentational filter panel. Used inline as a desktop sidebar and inside the
 * mobile drawer. All filtering happens client side on the synced dataset.
 */
export function CardFilters({
  values,
  positions,
  nations,
  searchDraft,
  onSearchDraft,
  onChange,
  onClear,
  activeCount,
}: {
  values: CardFilterValues;
  positions: string[];
  nations: string[];
  searchDraft: string;
  onSearchDraft: (value: string) => void;
  onChange: (patch: Partial<CardFilterValues>) => void;
  onClear: () => void;
  activeCount: number;
}) {
  return (
    <div className="space-y-4 text-left">
      <div>
        <label htmlFor="card-search" className="filter-label">
          Player name
        </label>
        <div className="relative mt-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="card-search"
            type="search"
            value={searchDraft}
            onChange={(e) => onSearchDraft(e.target.value)}
            placeholder="Search player name…"
            className="field focus-ring min-h-11 w-full pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="filter-position" className="filter-label">
            Position
          </label>
          <select
            id="filter-position"
            value={values.position}
            onChange={(e) => onChange({ position: e.target.value })}
            className="field focus-ring mt-1 min-h-11 w-full"
          >
            <option value="">All</option>
            {positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-nation" className="filter-label">
            Nation
          </label>
          <select
            id="filter-nation"
            value={values.nation}
            onChange={(e) => onChange({ nation: e.target.value })}
            className="field focus-ring mt-1 min-h-11 w-full"
          >
            <option value="">All</option>
            {nations.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="filter-ovr-min" className="filter-label">
            OVR min
          </label>
          <input
            id="filter-ovr-min"
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={values.ovrMin}
            onChange={(e) => onChange({ ovrMin: e.target.value })}
            placeholder="—"
            className="field focus-ring mt-1 min-h-11 w-full"
          />
        </div>
        <div>
          <label htmlFor="filter-ovr-max" className="filter-label">
            OVR max
          </label>
          <input
            id="filter-ovr-max"
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={values.ovrMax}
            onChange={(e) => onChange({ ovrMax: e.target.value })}
            placeholder="—"
            className="field focus-ring mt-1 min-h-11 w-full"
          />
        </div>
      </div>

      <fieldset>
        <legend className="filter-label">Minimum stats</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {STAT_KEYS.map((key) => (
            <div key={key}>
              <label htmlFor={`filter-${key}`} className="sr-only">
                Minimum {STAT_LABELS[key]}
              </label>
              <input
                id={`filter-${key}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={120}
                value={values[key]}
                onChange={(e) => onChange({ [key]: e.target.value } as Partial<CardFilterValues>)}
                placeholder={STAT_LABELS[key]}
                aria-label={`Minimum ${STAT_LABELS[key]}`}
                className="field focus-ring min-h-11 w-full text-center"
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="filter-perk" className="filter-label">
          Perk
        </label>
        <input
          id="filter-perk"
          type="search"
          value={values.perk}
          onChange={(e) => onChange({ perk: e.target.value })}
          placeholder="Search perk…"
          className="field focus-ring mt-1 min-h-11 w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="filter-sort" className="filter-label">
            Sort by
          </label>
          <select
            id="filter-sort"
            value={values.sort}
            onChange={(e) => onChange({ sort: e.target.value as SortKey })}
            className="field focus-ring mt-1 min-h-11 w-full"
          >
            {SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-dir" className="filter-label">
            Order
          </label>
          <select
            id="filter-dir"
            value={values.dir}
            onChange={(e) => onChange({ dir: e.target.value as "asc" | "desc" })}
            className="field focus-ring mt-1 min-h-11 w-full"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        className="btn-secondary focus-ring w-full"
        onClick={onClear}
        disabled={activeCount === 0}
      >
        Clear filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
    </div>
  );
}
