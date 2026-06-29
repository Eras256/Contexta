"use client";

/**
 * Local record of the DeFindex vaults the user has deployed (real on-chain
 * factory deploys). The vaults themselves live on Soroban; this list is a
 * client-side index so the dashboard can show "your deployed vaults" with their
 * contract address + deploy tx. Per-browser (no DB migration needed).
 */
export interface DeployedVault {
  name: string;
  asset: string;
  /** Vault contract address (C…), when the deploy returned it. */
  address?: string;
  txHash: string;
  createdAt: string;
}

const KEY = "contextio.vaults";

export function getVaults(): DeployedVault[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DeployedVault[]) : [];
  } catch {
    return [];
  }
}

export function addVault(v: DeployedVault): DeployedVault[] {
  const next = [v, ...getVaults().filter((x) => x.txHash !== v.txHash)].slice(0, 20);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function removeVault(txHash: string): DeployedVault[] {
  const next = getVaults().filter((x) => x.txHash !== txHash);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
