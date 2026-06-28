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
}

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
  const [state, setState] = useState<LiveResult<T>>({
    data: demo,
    live: false,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!accessToken || !tenantId) {
      setState({ data: demo, live: false, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const d = await fetcher({ accessToken, tenantId });
      setState({ data: d, live: true, loading: false, error: null });
    } catch (e: unknown) {
      setState({ data: demo, live: false, loading: false, error: e instanceof Error ? e.message : String(e) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tenantId]);

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
