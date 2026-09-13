"use client";

/**
 * List state lives in the URL (PRD §11.5): a filtered view is a shareable link,
 * the back button works, and a refresh keeps the table you were looking at.
 *
 * Components read `state` and call `set()` / `reset()`; nothing else touches
 * `useSearchParams`, so every table behaves identically.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface ListState {
  q: string;
  status: string;
  carrier: string;
  client: string;
  assignedTo: string;
  from: string;
  to: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
  /** Extra resource-specific filters (§14.3 uses syncState). */
  [key: string]: string | number;
}

const DEFAULTS: ListState = {
  q: "",
  status: "",
  carrier: "",
  client: "",
  assignedTo: "",
  from: "",
  to: "",
  sort: "",
  dir: "desc",
  page: 1,
  pageSize: 25,
};

const NUMERIC_KEYS = new Set(["page", "pageSize"]);

export interface ListStateApi {
  state: ListState;
  set: (patch: Partial<ListState>) => void;
  /** Paging and sorting always reset to page 1 unless page is in the patch. */
  setFilter: (patch: Partial<ListState>) => void;
  reset: () => void;
  clearOne: (key: keyof ListState | string) => void;
  activeFilterCount: number;
  /** Query string for the API, with empty values dropped. */
  query: Record<string, string | number>;
}

export function useListState(overrides?: Partial<ListState>): ListStateApi {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaults = useMemo<ListState>(() => ({ ...DEFAULTS, ...overrides }) as ListState, [overrides]);

  const state = useMemo<ListState>(() => {
    const next: ListState = { ...defaults };
    for (const [key, value] of searchParams.entries()) {
      if (value === "") continue;
      next[key] = NUMERIC_KEYS.has(key) ? Number(value) || defaults[key as "page"] : value;
    }
    return next;
  }, [searchParams, defaults]);

  const write = useCallback(
    (next: ListState) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) {
        if (value === "" || value === undefined || value === null) continue;
        if (String(value) === String(defaults[key as keyof ListState] ?? "")) continue;
        params.set(key, String(value));
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, defaults],
  );

  const set = useCallback((patch: Partial<ListState>) => write({ ...state, ...patch } as ListState), [state, write]);

  const setFilter = useCallback(
    (patch: Partial<ListState>) => write({ ...state, ...patch, page: patch.page ?? 1 } as ListState),
    [state, write],
  );

  const reset = useCallback(() => write(defaults), [write, defaults]);

  const clearOne = useCallback(
    (key: keyof ListState | string) => {
      const next = { ...state, [key]: defaults[key as keyof ListState] ?? "" } as ListState;
      next.page = 1;
      write(next);
    },
    [state, write, defaults],
  );

  const activeFilterCount = useMemo(
    () =>
      (["q", "status", "carrier", "client", "assignedTo", "from", "to"] as const).filter(
        (key) => state[key] !== "" && state[key] !== undefined,
      ).length,
    [state],
  );

  const query = useMemo(() => {
    const out: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(state)) {
      if (value === "" || value === undefined || value === null) continue;
      out[key] = value as string | number;
    }
    return out;
  }, [state]);

  return { state, set, setFilter, reset, clearOne, activeFilterCount, query };
}

/** Debounces a fast-changing value (the search box) before it hits the URL. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Calls back once per identity change of `key` — used for "new item" toasts. */
export function useOnChange<T>(key: T, callback: (value: T, previous: T | undefined) => void): void {
  const previous = useRef<T | undefined>(undefined);
  useEffect(() => {
    callback(key, previous.current);
    previous.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
