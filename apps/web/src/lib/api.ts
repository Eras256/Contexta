/**
 * Typed client for the Contextio API. Components pass a Supabase access token +
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
    agentEnabled: boolean;
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

export interface PayrollEmployee {
  id: string;
  fullName: string;
  email: string | null;
  country: string;
  payoutAsset: string;
  preferredRail: string;
  salaryAmount: string;
  active: boolean;
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
  employees: (auth: ApiAuth) => request<PayrollEmployee[]>("/payroll/employees", auth),
  decisions: (auth: ApiAuth) => request<Decision[]>("/agent/decisions", auth),
  legal: (auth: ApiAuth) => request<LegalState>("/legal", auth),
  propose: (auth: ApiAuth, execute: boolean, ai?: { provider?: string; model?: string; apiKey?: string }) =>
    request<Decision>("/agent/propose", auth, {
      method: "POST",
      body: JSON.stringify({
        execute,
        ...(ai?.provider ? { aiProvider: ai.provider } : {}),
        ...(ai?.model ? { aiModel: ai.model } : {}),
        ...(ai?.apiKey ? { aiApiKey: ai.apiKey } : {}),
      }),
    }),

  // ── Manual treasury controls (dashboard) ──────────────────────────────────
  /** Persist the risk config (min liquidity, max-yield %, FX sensitivity). */
  saveConfig: (
    auth: ApiAuth,
    cfg: {
      minLiquidityBaseUnits: string;
      maxYieldBps: number;
      volatilitySensitivity: number;
      countryLimitsBps?: Record<string, number>;
      agentEnabled?: boolean;
    },
  ) => request<unknown>("/treasury/config", auth, { method: "PUT", body: JSON.stringify(cfg) }),

  /** Move capital between liquidity and a yield venue — real on-chain rebalance. */
  rebalance: (
    auth: ApiAuth,
    move: {
      from: "liquidity" | "defindex_vault" | "blend_pool";
      to: "liquidity" | "defindex_vault" | "blend_pool";
      asset: string;
      amountBaseUnits: string;
      strategyRef: string;
    },
  ) => request<{ txHash: string; legalContextHash: string }>("/treasury/rebalance", auth, {
    method: "POST",
    body: JSON.stringify(move),
  }),

  /** Activate / deactivate the autonomous agent for this tenant. */
  toggleAgent: (auth: ApiAuth, enabled: boolean) =>
    request<{ agentEnabled: boolean }>("/treasury/agent", auth, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),

  /** Step 1 of a self-custody move: get an unsigned Blend tx for the user to sign. */
  prepareMove: (
    auth: ApiAuth,
    body: { direction: "supply" | "withdraw"; asset: "XLM" | "USDC"; amountBaseUnits: string; address: string },
  ) => request<{ xdr: string }>("/treasury/prepare", auth, { method: "POST", body: JSON.stringify(body) }),

  /** Step 2: submit the user-signed envelope. */
  submitMove: (auth: ApiAuth, signedXdr: string) =>
    request<{ txHash: string; legalContextHash: string }>("/treasury/submit", auth, {
      method: "POST",
      body: JSON.stringify({ signedXdr }),
    }),

  /** Create / register a yield vault (DeFindex factory; returns the live vault). */
  createVault: (auth: ApiAuth, vault: { name: string; asset: string; strategy: string }) =>
    request<{ vaultId?: string; name?: string }>("/integrations/defindex/vaults", auth, {
      method: "POST",
      body: JSON.stringify(vault),
    }),
};

/** Live status of the LLM powering the agent's reasoning (public, no auth). */
export interface AiStatus {
  live: boolean;
  provider: string;
  model: string | null;
}

export async function fetchAiStatus(): Promise<AiStatus> {
  const res = await fetch(`${API_URL}/api/v1/public/ai`, { cache: "no-store" });
  if (!res.ok) return { live: false, provider: "none", model: null };
  return (await res.json()) as AiStatus;
}

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
