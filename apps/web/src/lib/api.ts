/**
 * Typed client for the Contexta API. The UI ships with demo data so it runs
 * standalone; when NEXT_PUBLIC_API_URL is configured, components can switch to
 * live data via these helpers. Auth is a Supabase access token + tenant id.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface ApiAuth {
  accessToken: string;
  tenantId: string;
}

async function request<T>(path: string, auth: ApiAuth, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.accessToken}`,
      "x-tenant-id": auth.tenantId,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  treasury: (auth: ApiAuth) => request("/treasury", auth),
  obligations: (auth: ApiAuth) => request("/payroll/obligations", auth),
  decisions: (auth: ApiAuth) => request("/agent/decisions", auth),
  propose: (auth: ApiAuth, execute: boolean) =>
    request("/agent/propose", auth, { method: "POST", body: JSON.stringify({ execute }) }),
};

export const apiBaseUrl = API_URL;
