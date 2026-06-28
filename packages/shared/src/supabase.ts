import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  });
}

export type { SupabaseClient };
