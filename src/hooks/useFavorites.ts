import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "uflbase.favorites.v1";

let cache: string[] = [];
let snapshotJson = "[]";
const listeners = new Set<() => void>();

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function refresh() {
  const next = read();
  const json = JSON.stringify(next);
  if (json !== snapshotJson) {
    snapshotJson = json;
    cache = next;
  }
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) refresh();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) {
      refresh();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const EMPTY: string[] = [];
const getSnapshot = () => cache;
const getServerSnapshot = () => EMPTY;

function write(next: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode) — keep in-memory state */
  }
  cache = next;
  snapshotJson = JSON.stringify(next);
  emit();
}

/**
 * Favorites are stored per browser by stable spreadsheet row id.
 * They never touch the Google Sheets source data.
 */
export function useFavorites() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((id: string) => {
    const current = read();
    write(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }, []);

  const clear = useCallback(() => write([]), []);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, toggle, clear, isFavorite };
}
