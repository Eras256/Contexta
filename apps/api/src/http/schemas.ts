import { z } from "zod";

/** Zod request schemas — every state-changing endpoint validates its body. */

const country = z.enum(["BR", "AR", "CO"]);
const asset = z.enum(["USDC", "XLM", "CETES", "BRL", "ARS", "COP"]);
const rail = z.enum(["PIX", "TRANSFERENCIAS_3", "BRE_B", "STELLAR", "SEP24", "SEP31"]);
const decimal = z.string().regex(/^\d+(\.\d{1,7})?$/u, "Expected a non-negative decimal");

export const treasuryConfigSchema = z.object({
  minLiquidityBaseUnits: z.string().regex(/^\d+$/u),
  maxYieldBps: z.number().int().min(0).max(10_000),
  countryLimitsBps: z.record(country, z.number().int().min(0).max(10_000)).default({}),
  volatilitySensitivity: z.number().int().min(0).max(100),
  agentEnabled: z.boolean().default(true),
});

/** Toggle the autonomous agent on/off for the tenant (dashboard switch). */
export const agentToggleSchema = z.object({
  enabled: z.boolean(),
});

export const rebalanceSchema = z.object({
  from: z.enum(["liquidity", "defindex_vault", "blend_pool"]),
  to: z.enum(["liquidity", "defindex_vault", "blend_pool"]),
  asset,
  amountBaseUnits: z.string().regex(/^\d+$/u),
  strategyRef: z.string().min(1),
});

export const employeeSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().min(1).max(120),
  email: z.string().email().nullable().optional(),
  country,
  walletAddress: z.string().nullable().optional(),
  bankReference: z.string().nullable().optional(),
  payoutAsset: asset,
  preferredRail: rail,
  salaryAmount: decimal,
  active: z.boolean().default(true),
});

export const scheduleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  cadence: z.enum(["weekly", "biweekly", "monthly", "one_off"]),
  nextRunAt: z.string().datetime(),
  asset,
  rail,
  employeeIds: z.array(z.string().uuid()).min(1),
  active: z.boolean().default(true),
});

export const runSchema = z.object({
  scheduleId: z.string().uuid(),
  dryRun: z.boolean().default(false),
});

export const publishLegalSchema = z.object({
  providerLegalName: z.string().min(1),
  providerJurisdiction: z.string().min(2),
  providerContactEmail: z.string().email(),
  termsUrl: z.string().url(),
  termsText: z.string().optional(),
  jurisdictions: z.array(z.string().min(2)).min(1),
});

export const proposeSchema = z.object({
  execute: z.boolean().default(false),
  // Optional per-request override of the LLM that writes the rationale (the
  // dashboard AI selector). `aiProvider` is a known provider id (the server maps
  // it to an OpenAI-compatible base URL); with `aiApiKey` this is a BYOK run.
  // Without a key, only `aiModel` applies (uses the server-configured provider).
  aiProvider: z.enum(["openai", "anthropic", "openrouter", "groq", "deepseek", "xai", "together"]).optional(),
  aiModel: z.string().min(1).max(96).optional(),
  aiApiKey: z.string().min(1).max(400).optional(),
});

export const vaultCreateSchema = z.object({
  name: z.string().min(1),
  asset: z.string().min(1),
  strategy: z.string().min(1),
});

export const blendOpSchema = z.object({
  asset: z.string().min(1),
  amountBaseUnits: z.string().regex(/^\d+$/u),
});

const stellarAddress = z.string().regex(/^G[A-Z2-7]{55}$/u, "Expected a Stellar public key (G...)");

export const walletChallengeSchema = z.object({
  address: stellarAddress,
});

export const walletVerifySchema = z.object({
  address: stellarAddress,
  message: z.string().min(1).max(2000),
  hmac: z.string().min(1),
  signedMessage: z.string().min(1).max(2000),
});
