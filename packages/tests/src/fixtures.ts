import type {
  AgentDecision,
  PayrollEmployee,
  PayrollSchedule,
  Tenant,
  TreasuryConfig,
  TreasuryPosition,
} from "@contexta/shared";

/**
 * Deterministic fixtures used across unit/integration tests and local seed data.
 * Amounts are expressed in their natural unit (USDC has 6 decimals upstream but
 * we normalize to 7-dp Stellar base units in the money helpers).
 */

export const tenantAcme: Tenant = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Acme LATAM",
  domain: "acme.contexta.app",
  country: "BR",
  legalContextId: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const treasuryConfigAcme: TreasuryConfig = {
  id: "00000000-0000-4000-8000-000000000010",
  tenantId: tenantAcme.id,
  minLiquidityBaseUnits: "500000000000", // 50,000 USDC in 7-dp base units
  maxYieldBps: 6000, // up to 60% in yield
  countryLimitsBps: { BR: 5000, AR: 3000, CO: 3000 },
  volatilitySensitivity: 60,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export const positionsAcme: TreasuryPosition[] = [
  {
    id: "00000000-0000-4000-8000-000000000020",
    tenantId: tenantAcme.id,
    asset: "USDC",
    strategy: "liquidity",
    strategyRef: null,
    amountBaseUnits: "800000000000", // 80,000 USDC liquid
    apyBps: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000021",
    tenantId: tenantAcme.id,
    asset: "CETES",
    strategy: "defindex_vault",
    strategyRef: "vault_cetes_rwa_001",
    amountBaseUnits: "1200000000000", // 120,000 in CETES RWA vault
    apyBps: 1075,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000022",
    tenantId: tenantAcme.id,
    asset: "USDC",
    strategy: "blend_pool",
    strategyRef: "blend_pool_main",
    amountBaseUnits: "300000000000", // 30,000 USDC supplied to Blend
    apyBps: 540,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

export const employeesAcme: PayrollEmployee[] = [
  {
    id: "00000000-0000-4000-8000-000000000030",
    tenantId: tenantAcme.id,
    fullName: "Ana Souza",
    email: "ana@acme.example",
    country: "BR",
    walletAddress: null,
    bankReference: "ana.souza@pix.example",
    payoutAsset: "BRL",
    preferredRail: "PIX",
    salaryAmount: "4500.00",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000031",
    tenantId: tenantAcme.id,
    fullName: "Bruno Díaz",
    email: "bruno@acme.example",
    country: "AR",
    walletAddress: "GBRUNO...EXAMPLE",
    bankReference: null,
    payoutAsset: "USDC",
    preferredRail: "STELLAR",
    salaryAmount: "3800.00",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000032",
    tenantId: tenantAcme.id,
    fullName: "Carolina Gómez",
    email: "caro@acme.example",
    country: "CO",
    walletAddress: null,
    bankReference: "bre-b:caro.gomez",
    payoutAsset: "COP",
    preferredRail: "BRE_B",
    salaryAmount: "3200.00",
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

export const scheduleAcme: PayrollSchedule = {
  id: "00000000-0000-4000-8000-000000000040",
  tenantId: tenantAcme.id,
  name: "Monthly LATAM payroll",
  cadence: "monthly",
  nextRunAt: "2026-07-01T12:00:00.000Z",
  asset: "USDC",
  rail: "STELLAR",
  employeeIds: employeesAcme.map((e) => e.id),
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const agentDecisionSample: AgentDecision = {
  id: "00000000-0000-4000-8000-000000000050",
  tenantId: tenantAcme.id,
  action: "rebalance",
  rationale:
    "Upcoming payroll obligation of 11,500 USDC due in 4 days; liquid buffer is sufficient, " +
    "moving 20,000 USDC excess into CETES vault to capture 10.75% APY.",
  payload: {
    from: "liquidity",
    to: "defindex_vault",
    asset: "USDC",
    amount: "20000.00",
    vaultId: "vault_cetes_rwa_001",
  },
  status: "proposed",
  legalContextId: tenantAcme.legalContextId,
  legalContextHash: null,
  stellarTxHash: null,
  createdAt: "2026-06-27T00:00:00.000Z",
  decidedAt: null,
};
