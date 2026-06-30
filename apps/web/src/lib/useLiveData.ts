"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import type { ApiAuth } from "./api";

export interface LiveResult<T> {
  data: T;
  live: boolean;
  loading: boolean;
  error: string | null;
}

export interface LiveOptions {
  /**
   * A tenant-scoped table to subscribe to via Supabase Realtime. On any insert/
   * update/delete (RLS-filtered to the user's tenant) the data is refetched, so
   * the dashboard updates live without polling.
   */
  realtimeTable?: string;
  /** Stable cache key; defaults to the fetcher's function name. */
  cacheKey?: string;
}

/**
 * Module-level stale-while-revalidate cache. Keeps the last successful payload
 * per (endpoint, tenant) so navigating back to a section shows real data
 * instantly (no skeleton flash) while a fresh fetch revalidates in the
 * background. Cleared on a full page reload.
 */
const liveCache = new Map<string, unknown>();

/**
 * Fetch live API data when the user is authenticated; otherwise fall back to the
 * provided demo value so the page renders standalone. Returns a `live` flag so
 * the UI can badge real vs demo data. Optionally subscribes to Realtime.
 */
export function useLiveData<T>(
  fetcher: (auth: ApiAuth) => Promise<T>,
  demo: T,
  opts: LiveOptions = {},
): LiveResult<T> {
  const { accessToken, tenantId, loading: authLoading } = useAuth();
  const key = `${opts.cacheKey ?? fetcher.name ?? "fn"}:${tenantId ?? ""}`;

  const [state, setState] = useState<LiveResult<T>>(() => {
    const cached = liveCache.get(key) as T | undefined;
    return cached !== undefined
      ? { data: cached, live: true, loading: false, error: null }
      : { data: demo, live: false, loading: true, error: null };
  });

  const load = useCallback(async () => {
    if (!accessToken || !tenantId) {
      setState({ data: demo, live: false, loading: false, error: null });
      return;
    }
    // Show a skeleton only on a cold load; if we have cached data, revalidate silently.
    setState((s) => ({ ...s, loading: !liveCache.has(key) }));
    try {
      const d = await fetcher({ accessToken, tenantId });
      liveCache.set(key, d);
      setState({ data: d, live: true, loading: false, error: null });
    } catch (e: unknown) {
      setState((s) => ({
        ...s,
        live: liveCache.has(key),
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tenantId, key]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  // Realtime: refetch on tenant-scoped changes to the watched table.
  useEffect(() => {
    const table = opts.realtimeTable;
    if (!table || !supabase || !accessToken || !tenantId) return;
    const channel = supabase
      .channel(`rt:${table}:${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `tenant_id=eq.${tenantId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [opts.realtimeTable, accessToken, tenantId, load]);

  return state;
}
