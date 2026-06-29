import { z } from "zod";

/**
 * Single source of truth for environment configuration across every Contextio
 * service. Each app calls `loadEnv()` once at boot; an invalid environment
 * fails fast with a readable error instead of surfacing as a runtime null.
 */

const booleanFromString = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1");

const csv = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );

export const StellarNetwork = z.enum(["testnet", "mainnet", "local"]);
export type StellarNetwork = z.infer<typeof StellarNetwork>;

/**
 * Base schema shared by all runtimes. App-specific schemas extend this so the
 * web bundle never requires the service-role key, while the API/worker do.
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),

  // Stellar
  STELLAR_NETWORK: StellarNetwork.default("testnet"),
  STELLAR_RPC_URL: z.string().url(),
  STELLAR_HORIZON_URL: z.string().url(),
  STELLAR_NETWORK_PASSPHRASE: z.string().min(1),

  // LCP
  LCP_PLATFORM_DOMAIN: z.string().min(1).default("contextio.xyz"),
});

/** Server-side (API + worker) schema: adds secrets that must never reach the browser. */
export const serverEnvSchema = baseEnvSchema.extend({
  API_PORT: z.coerce.number().int().positive().default(8080),
  API_HOST: z.string().default("0.0.0.0"),
  CORS_ORIGINS: csv,
  INTERNAL_API_SECRET: z.string().min(16, "INTERNAL_API_SECRET must be at least 16 chars"),

  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  STELLAR_SERVICE_SECRET: z
    .string()
    .regex(/^S[A-Z2-7]{55}$/u, "Expected a Stellar secret seed (S...)")
    .optional()
    .or(z.literal("")),
  TREASURY_CONTRACT_ID: z.string().optional().or(z.literal("")),
  PAYROLL_CONTRACT_ID: z.string().optional().or(z.literal("")),
  USDC_CONTRACT_ID: z.string().optional().or(z.literal("")),
  /** Classic issuer (G…) of the USDC used for real payroll payouts. */
  USDC_ISSUER: z.string().optional().or(z.literal("")),

  DEFINDEX_API_URL: z.string().url().default("https://api.defindex.io"),
  DEFINDEX_API_KEY: z.string().optional().or(z.literal("")),
  DEFINDEX_FACTORY_CONTRACT_ID: z.string().optional().or(z.literal("")),
  DEFINDEX_VAULT_ID: z.string().optional().or(z.literal("")),
  DEFINDEX_NETWORK: z.string().default("testnet"),

  BLEND_POOL_CONTRACT_ID: z.string().optional().or(z.literal("")),
  BLEND_BACKSTOP_CONTRACT_ID: z.string().optional().or(z.literal("")),
  BLEND_ORACLE_CONTRACT_ID: z.string().optional().or(z.literal("")),
  BLEND_ASSET_ID: z.string().optional().or(z.literal("")),
  /** SEP-24 off-ramp anchor base URL (testnet reference anchor by default). */
  ANCHOR_SEP24_URL: z.string().default("https://testanchor.stellar.org"),
  // Signer for Blend supply/withdraw. Defaults to STELLAR_SERVICE_SECRET, but for
  // USDC lending it must be the account that actually holds the BlendUSDC (the
  // agent wallet), so this overrides the signer for the Blend client only.
  BLEND_SIGNER_SECRET: z.string().optional().or(z.literal("")),

  FX_PROVIDER: z.enum(["mock", "http"]).default("mock"),
  FX_API_URL: z.string().url().optional().or(z.literal("")),
  FX_API_KEY: z.string().optional().or(z.literal("")),

  // Wallet auth (Sign In With Stellar). Session JWTs are signed with the
  // Supabase JWT secret (HS256) so they also authorize Supabase Realtime/RLS.
  // A freshly-connected wallet auto-joins this tenant with AUTH_DEMO_ROLE (demo
  // convenience); leave AUTH_DEMO_TENANT_ID blank to disable auto-join.
  AUTH_DEMO_TENANT_ID: z.string().optional().or(z.literal("")),
  AUTH_DEMO_ROLE: z.enum(["owner", "admin", "member", "viewer"]).default("owner"),
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(3600),

  // Public Stellar address of the autonomous agent (shown in the Home live feed).
  AGENT_PUBLIC_ADDRESS: z.string().optional().or(z.literal("")),
});

/** Worker-only extras layered on top of the server schema. */
export const workerEnvSchema = serverEnvSchema.extend({
  AGENT_POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),
  AGENT_DRY_RUN: booleanFromString.default(true),
  API_BASE_URL: z.string().url().default("http://localhost:8080"),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  source: NodeJS.ProcessEnv,
): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return parseOrThrow(serverEnvSchema, source);
}

export function loadWorkerEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  return parseOrThrow(workerEnvSchema, source);
}

export function loadBaseEnv(source: NodeJS.ProcessEnv = process.env): BaseEnv {
  return parseOrThrow(baseEnvSchema, source);
}
