/**
 * Demo data for standalone UI rendering. Mirrors @contexta/tests fixtures so the
 * frontend is fully explorable without the API running. In a connected
 * deployment these are replaced by fetches to `apps/api` (see lib/api.ts).
 */

export interface DemoPosition {
  asset: string;
  strategy: "liquidity" | "defindex_vault" | "blend_pool";
  strategyRef: string | null;
  amountBaseUnits: string;
  apyBps: number | null;
}

export const demoTenant = {
  name: "Acme LATAM",
  domain: "acme.contexta.app",
  country: "BR",
  legalContextId: "11111111-1111-4111-8111-111111111111",
  legalContextHash: "b3f1c0a9d2e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d",
};

export const demoPositions: DemoPosition[] = [
  { asset: "USDC", strategy: "liquidity", strategyRef: null, amountBaseUnits: "800000000000", apyBps: null },
  { asset: "XLM", strategy: "liquidity", strategyRef: null, amountBaseUnits: "150000000000", apyBps: null },
  { asset: "CETES", strategy: "defindex_vault", strategyRef: "vault_cetes_rwa_001", amountBaseUnits: "1200000000000", apyBps: 1075 },
  { asset: "USDC", strategy: "blend_pool", strategyRef: "blend_pool_main", amountBaseUnits: "300000000000", apyBps: 540 },
];

export const demoEmployees = [
  { id: "e1", fullName: "Ana Souza", country: "BR", payoutAsset: "BRL", preferredRail: "PIX", salaryAmount: "4500.00", active: true },
  { id: "e2", fullName: "Bruno Díaz", country: "AR", payoutAsset: "USDC", preferredRail: "STELLAR", salaryAmount: "3800.00", active: true },
  { id: "e3", fullName: "Carolina Gómez", country: "CO", payoutAsset: "COP", preferredRail: "BRE_B", salaryAmount: "3200.00", active: true },
  { id: "e4", fullName: "Diego Fernández", country: "AR", payoutAsset: "USDC", preferredRail: "STELLAR", salaryAmount: "4100.00", active: true },
];

export const demoSchedule = {
  name: "Monthly LATAM payroll",
  cadence: "monthly",
  nextRunAt: "2026-07-01T12:00:00.000Z",
  asset: "USDC",
  requiredBaseUnits: "156000000000",
  employeeCount: 4,
};

export const demoDecisions = [
  {
    id: "d1",
    action: "deposit_vault",
    rationale:
      "Liquid 95,000 USDC exceeds required 62,400 (payroll due 15,600 + 8,200 USD/BRL volatility buffer). Allocating 20,000 to CETES vault for 10.75% APY.",
    status: "executed",
    legalContextHash: "b3f1c0a9d2e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d",
    stellarTxHash: "sim:treasury:1a2b3c4d",
    createdAt: "2026-06-26T09:12:00.000Z",
  },
  {
    id: "d2",
    action: "withdraw_vault",
    rationale:
      "Liquid 48,000 USDC below required 70,000 ahead of bi-weekly payroll. Withdrawing 25,000 from CETES vault to cover obligations.",
    status: "executed",
    legalContextHash: "b3f1c0a9d2e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d",
    stellarTxHash: "sim:treasury:9f8e7d6c",
    createdAt: "2026-06-20T09:12:00.000Z",
  },
  {
    id: "d3",
    action: "noop",
    rationale: "Treasury allocation within target band; no action required.",
    status: "proposed",
    legalContextHash: null,
    stellarTxHash: null,
    createdAt: "2026-06-27T09:12:00.000Z",
  },
];

export const demoVaults = [
  { vaultId: "vault_cetes_rwa_001", name: "CETES RWA Yield", asset: "CETES", apyBps: 1075, tvlBaseUnits: "1200000000000" },
  { vaultId: "vault_usdc_money_market_001", name: "USDC Money Market", asset: "USDC", apyBps: 720, tvlBaseUnits: "4500000000000" },
];

export function totals(positions: DemoPosition[]) {
  let liquid = 0n;
  let yld = 0n;
  for (const p of positions) {
    const amt = BigInt(p.amountBaseUnits);
    if (p.strategy === "liquidity") liquid += amt;
    else yld += amt;
  }
  const total = liquid + yld;
  const yieldShareBps = total === 0n ? 0 : Number((yld * 10000n) / total);
  return {
    liquidBaseUnits: liquid.toString(),
    yieldBaseUnits: yld.toString(),
    totalBaseUnits: total.toString(),
    yieldShareBps,
  };
}
