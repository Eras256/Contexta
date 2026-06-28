/**
 * Typed client for the Contexta API. Components pass a Supabase access token +
 * tenant id (from the auth context). The API verifies the token (JWKS/HS256),
 * checks tenant membership, and enforces RBAC + the Legal Context Protocol.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface ApiAuth {
  accessToken: string;
  tenantId: string;
}

export interface TreasurySnapshot {
  config: {
    minLiquidityBaseUnits: string;
    maxYieldBps: number;
    volatilitySensitivity: number;
    countryLimitsBps: Record<string, number>;
  } | null;
  positions: {
    asset: string;
    strategy: "liquidity" | "defindex_vault" | "blend_pool";
    strategyRef: string | null;
    amountBaseUnits: string;
    apyBps: number | null;
  }[];
  totals: {
    liquidBaseUnits: string;
    yieldBaseUnits: string;
    totalBaseUnits: string;
    yieldShareBps: number;
  };
}

export interface Obligation {
  scheduleId: string;
  scheduleName: string;
  nextRunAt: string;
  asset: string;
  requiredBaseUnits: string;
  employeeCount?: number;
}

export interface Decision {
  id: string;
  action: string;
  rationale: string;
  status: string;
  legalContextHash: string | null;
  stellarTxHash: string | null;
  createdAt: string;
}

export interface LegalState {
  published: boolean;
  hash?: string;
  document?: Record<string, unknown>;
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
  treasury: (auth: ApiAuth) => request<TreasurySnapshot>("/treasury", auth),
  obligations: (auth: ApiAuth) => request<Obligation[]>("/payroll/obligations", auth),
  decisions: (auth: ApiAuth) => request<Decision[]>("/agent/decisions", auth),
  legal: (auth: ApiAuth) => request<LegalState>("/legal", auth),
  propose: (auth: ApiAuth, execute: boolean) =>
    request<Decision>("/agent/propose", auth, {
      method: "POST",
      body: JSON.stringify({ execute }),
    }),
};

export const apiBaseUrl = API_URL;

// ── Wallet sign-in handshake (no bearer) ───────────────────────────────────
export interface WalletChallenge {
  message: string;
  hmac: string;
}

export interface WalletSession {
  token: string;
  tokenType: "Bearer";
  expiresAt: string;
  address: string;
  userId: string;
  tenantId: string;
  role: string;
}

async function postPublic<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((json.error as string) ?? `API ${path} -> ${res.status}`);
  return json as T;
}

export const authApi = {
  challenge: (address: string) =>
    postPublic<WalletChallenge>("/auth/wallet/challenge", { address }),
  verify: (input: { address: string; message: string; hmac: string; signedMessage: string }) =>
    postPublic<WalletSession>("/auth/wallet/verify", input),
};
