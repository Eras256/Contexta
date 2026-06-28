/**
 * In-memory DeFindex mock mirroring the subset of the DeFindex API the platform
 * uses: list vaults, create vault, deposit, withdraw, read strategy metadata.
 * Used by integration tests and by the API when DEFINDEX_API_KEY is absent.
 */
export interface MockVault {
  vaultId: string;
  name: string;
  asset: string;
  strategy: string;
  apyBps: number;
  tvlBaseUnits: string;
}

export interface DefindexMock {
  listVaults(): Promise<MockVault[]>;
  createVault(input: { name: string; asset: string; strategy: string }): Promise<MockVault>;
  deposit(vaultId: string, amountBaseUnits: string): Promise<{ vaultId: string; tvlBaseUnits: string }>;
  withdraw(vaultId: string, amountBaseUnits: string): Promise<{ vaultId: string; tvlBaseUnits: string }>;
}

export function createDefindexMock(seed: MockVault[] = DEFAULT_VAULTS): DefindexMock {
  const vaults = new Map<string, MockVault>(seed.map((v) => [v.vaultId, { ...v }]));

  return {
    async listVaults() {
      return [...vaults.values()];
    },
    async createVault(input) {
      const vaultId = `vault_${input.strategy}_${vaults.size + 1}`;
      const vault: MockVault = {
        vaultId,
        name: input.name,
        asset: input.asset,
        strategy: input.strategy,
        apyBps: 1000,
        tvlBaseUnits: "0",
      };
      vaults.set(vaultId, vault);
      return vault;
    },
    async deposit(vaultId, amountBaseUnits) {
      const vault = vaults.get(vaultId);
      if (!vault) throw new Error(`MissingValue: vault ${vaultId} not found`);
      vault.tvlBaseUnits = (BigInt(vault.tvlBaseUnits) + BigInt(amountBaseUnits)).toString();
      return { vaultId, tvlBaseUnits: vault.tvlBaseUnits };
    },
    async withdraw(vaultId, amountBaseUnits) {
      const vault = vaults.get(vaultId);
      if (!vault) throw new Error(`MissingValue: vault ${vaultId} not found`);
      const next = BigInt(vault.tvlBaseUnits) - BigInt(amountBaseUnits);
      if (next < 0n) throw new Error("Insufficient vault balance");
      vault.tvlBaseUnits = next.toString();
      return { vaultId, tvlBaseUnits: vault.tvlBaseUnits };
    },
  };
}

export const DEFAULT_VAULTS: MockVault[] = [
  {
    vaultId: "vault_cetes_rwa_001",
    name: "CETES RWA Yield",
    asset: "CETES",
    strategy: "cetes_rwa",
    apyBps: 1075,
    tvlBaseUnits: "1200000000000",
  },
  {
    vaultId: "vault_usdc_money_market_001",
    name: "USDC Money Market",
    asset: "USDC",
    strategy: "usdc_mm",
    apyBps: 720,
    tvlBaseUnits: "4500000000000",
  },
];
