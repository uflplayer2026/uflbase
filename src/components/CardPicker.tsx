import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { PlayerCardRecord } from "@/lib/playerTypes";

/** Searchable, client-side card selector used by the Compare page. */
export function CardPicker({
  label,
  players,
  selectedId,
  onSelect,
  onClear,
}: {
  label: string;
  players: PlayerCardRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q === "" ? players : players.filter((p) => p.playerName.toLowerCase().includes(q));
    return base.slice(0, 30);
  }, [players, query]);

  return (
    <div className="surface-panel space-y-2 text-left">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </h2>
        {selectedId ? (
          <button type="button" className="chip focus-ring" onClick={onClear}>
            Replace
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player name…"
          aria-label={`Search a card for ${label}`}
          className="field focus-ring min-h-11 w-full pl-9"
        />
      </div>

      <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {matches.length === 0 ? (
          <li className="px-1 py-2 text-sm text-muted-foreground">
            No matching player cards found.
          </li>
        ) : (
          matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                data-selected={p.id === selectedId ? "true" : undefined}
                className="picker-row focus-ring"
              >
                <span className="truncate">{p.playerName || "—"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.position || "—"} · {p.ovr === null ? "—" : p.ovr}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
