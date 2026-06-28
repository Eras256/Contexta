import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

/**
 * supabase-js eagerly constructs a Realtime client, which needs a WebSocket
 * implementation. Node < 22 has no global `WebSocket`, so we supply `ws`. The
 * service/anon clients only ever use PostgREST (fetch) for DB access — Realtime
 * is never subscribed — so this just prevents the constructor from throwing.
 * These factories are backend-only (the web app never imports this module).
 */
type RealtimeOptions = NonNullable<NonNullable<Parameters<typeof createClient>[2]>["realtime"]>;
const realtimeTransport: RealtimeOptions = {
  transport: WebSocket as unknown as RealtimeOptions["transport"],
};

/**
 * Supabase client factories. Two distinct clients with different trust levels:
 *
 *  - `createServiceClient` uses the service-role key. BACKEND ONLY. Bypasses RLS.
 *    Used by api/worker to perform privileged, audited writes.
 *  - `createAnonClient` uses the anon key + a user's access token. Respects RLS.
 *    Safe for the browser and for per-request, user-scoped reads.
 */

export interface SupabaseServiceConfig {
  url: string;
  serviceRoleKey: string;
}

export interface SupabaseAnonConfig {
  url: string;
  anonKey: string;
  /** Optional end-user access token to scope requests under RLS. */
  accessToken?: string;
}

export function createServiceClient(config: SupabaseServiceConfig): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-contexta-client": "service" } },
    realtime: realtimeTransport,
  });
}

export function createAnonClient(config: SupabaseAnonConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        "x-contexta-client": "anon",
        ...(config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : {}),
      },
    },
    realtime: realtimeTransport,
  });
}

export type { SupabaseClient };
