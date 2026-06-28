import { type Logger, type Result, ok, err, tryAsync, stellar } from "@contextio/shared";
import { createDefindexMock, type DefindexMock, type MockVault } from "@contextio/tests/mocks";

/**
 * DeFindex integration. When an API key + vault + signer are configured we talk
 * to the live DeFindex REST API (https://api.defindex.io): reads (vault info,
 * APY, balance) are direct GETs; deposits/withdrawals return an unsigned
 * transaction XDR that we sign locally with the platform Stellar key and submit
 * via the API's `/send` endpoint. Without an API key we fall back to the
 * deterministic in-memory mock so the platform runs end-to-end offline.
 *
 * DeFindex docs: https://docs.defindex.io
 */
export interface DefindexConfig {
  apiUrl: string;
  apiKey?: string;
  /** "testnet" | "mainnet" — selects the DeFindex/Stellar network. */
  network?: string;
  /** Pre-deployed vault contract address the platform uses for real yield. */
  vaultId?: string;
  /** Platform Stellar secret that signs deposit/withdraw transactions. */
  signerSecret?: string;
  /** Network passphrase used to sign envelopes. */
  networkPassphrase?: string;
}

export interface Vault {
  vaultId: string;
  name: string;
  asset: string;
  strategy: string;
  apyBps: number;
  tvlBaseUnits: string;
}

/** Rich, UI-facing view of the live vault including the platform's own position. */
export interface VaultData extends Vault {
  network: string;
  positionBaseUnits: string;
  manager: string;
}

export class DefindexClient {
  private readonly mock: DefindexMock | null;
  private readonly signerAddress: string | null;

  constructor(
    private readonly config: DefindexConfig,
    private readonly logger: Logger,
  ) {
    this.mock = config.apiKey ? null : createDefindexMock();
    this.signerAddress = config.signerSecret
      ? stellar.Keypair.fromSecret(config.signerSecret).publicKey()
      : null;
    if (this.mock) {
      this.logger.warn("DEFINDEX_API_KEY not set — using in-memory DeFindex mock");
    } else if (!config.vaultId || !this.signerAddress) {
      this.logger.warn("DeFindex API key set but vault/signer missing — writes disabled, reads only");
    }
  }

  /** True when talking to the real DeFindex API (api key present). */
  get live(): boolean {
    return this.mock === null;
  }

  /** True when we can actually sign & submit on-chain (key + vault + signer). */
  get canWrite(): boolean {
    return this.live && !!this.config.vaultId && !!this.signerAddress;
  }

  get vaultId(): string | undefined {
    return this.config.vaultId;
  }

  async listVaults(): Promise<Result<Vault[]>> {
    if (this.mock) return ok((await this.mock.listVaults()) as Vault[]);
    return tryAsync(async () => [await this.fetchVault()]);
  }

  /** Live vault snapshot for the UI: asset, strategy, APY, TVL, our position. */
  async getVaultData(): Promise<Result<VaultData>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(async () => {
        const v = ((await mock.listVaults()) as Vault[])[0];
        if (!v) throw new Error("no mock vault available");
        return { ...v, network: "mock", positionBaseUnits: v.tvlBaseUnits, manager: "mock" };
      });
    }
    return tryAsync(() => this.fetchVault());
  }

  async createVault(input: {
    name: string;
    asset: string;
    strategy: string;
  }): Promise<Result<Vault>> {
    if (this.mock) return ok((await this.mock.createVault(input)) as Vault);
    // The platform vault is pre-deployed; surface it rather than minting a new one.
    return tryAsync(() => this.fetchVault());
  }

  /**
   * Deposit into the vault. Live mode: ask DeFindex for an unsigned XDR, sign it
   * with the platform key, and submit via `/send`. Recoverable on-chain errors
   * (expired TTL / MissingValue) are surfaced as a Result so callers can back off.
   */
  async deposit(vaultId: string, amountBaseUnits: string): Promise<Result<{ tvlBaseUnits: string; txHash?: string }>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(async () => {
        const r = await mock.deposit(vaultId, amountBaseUnits);
        return { tvlBaseUnits: r.tvlBaseUnits };
      });
    }
    const res = await tryAsync(() =>
      this.signedTx(`/vault/${vaultId || this.config.vaultId}/deposit`, {
        amounts: [Number(amountBaseUnits)],
        caller: this.signerAddress,
        invest: true,
        slippageBps: 50,
      }),
    );
    if (!res.ok && /MissingValue|TTL|trustline/i.test(res.error.message)) {
      this.logger.warn({ vaultId, error: res.error.message }, "DeFindex deposit recoverable error");
      return err(new Error(`DeFindex deposit deferred: ${res.error.message}`));
    }
    return res;
  }

  async withdraw(vaultId: string, amountBaseUnits: string): Promise<Result<{ tvlBaseUnits: string; txHash?: string }>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(async () => {
        const r = await mock.withdraw(vaultId, amountBaseUnits);
        return { tvlBaseUnits: r.tvlBaseUnits };
      });
    }
    return tryAsync(() =>
      this.signedTx(`/vault/${vaultId || this.config.vaultId}/withdraw`, {
        amounts: [Number(amountBaseUnits)],
        caller: this.signerAddress,
      }),
    );
  }

  // ── live helpers ──────────────────────────────────────────────────────────

  /** GET vault info + APY + our balance, mapped to the UI shape. */
  private async fetchVault(): Promise<VaultData> {
    const id = this.config.vaultId;
    if (!id) throw new Error("DEFINDEX_VAULT_ID not configured");
    const info = await this.request<DefindexVaultInfo>("GET", `/vault/${id}`);
    const asset = info.assets?.[0];
    const tvl = info.totalManagedFunds?.[0];
    const tvlBaseUnits = tvl
      ? (BigInt(tvl.idle_amount ?? "0") + BigInt(tvl.invested_amount ?? "0")).toString()
      : "0";
    let apyBps = 0;
    try {
      const a = await this.request<{ apy: number }>("GET", `/vault/${id}/apy`);
      apyBps = Math.round((a.apy ?? 0) * 100);
    } catch {
      /* apy optional */
    }
    let positionBaseUnits = "0";
    if (this.signerAddress) {
      try {
        const b = await this.request<{ underlyingBalance: string[] }>(
          "GET",
          `/vault/${id}/balance?from=${this.signerAddress}`,
        );
        positionBaseUnits = b.underlyingBalance?.[0] ?? "0";
      } catch {
        /* balance optional */
      }
    }
    const symbol = asset?.symbol === "native" ? "XLM" : (asset?.symbol ?? asset?.address ?? "—");
    return {
      vaultId: id,
      name: info.name ?? "DeFindex Vault",
      asset: symbol,
      strategy: asset?.strategies?.[0]?.name ?? "Strategy",
      apyBps,
      tvlBaseUnits,
      positionBaseUnits,
      network: this.config.network ?? "testnet",
      manager: info.roles?.manager ?? "—",
    };
  }

  /** Get unsigned XDR from DeFindex, sign locally, submit via /send. */
  private async signedTx(path: string, body: unknown): Promise<{ tvlBaseUnits: string; txHash?: string }> {
    if (!this.canWrite) throw new Error("DeFindex writes disabled (missing vault/signer)");
    const { xdr } = await this.request<{ xdr: string }>("POST", path, body);
    const signed = stellar.signEnvelopeXdr(
      xdr,
      this.config.signerSecret as string,
      this.config.networkPassphrase ?? "Test SDF Network ; September 2015",
    );
    const sent = await this.request<{ txHash: string; success: boolean }>("POST", "/send", { xdr: signed });
    if (!sent.success) throw new Error(`DeFindex /send failed for ${path}`);
    const data = await this.getVaultData();
    return { tvlBaseUnits: data.ok ? data.value.tvlBaseUnits : "0", txHash: sent.txHash };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const network = this.config.network ?? "testnet";
    const res = await fetch(`${this.config.apiUrl}${path}${sep}network=${network}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`DeFindex ${method} ${path} -> ${res.status}: ${await res.text()}`);
    }
    return (await res.json()) as T;
  }
}

interface DefindexVaultInfo {
  name?: string;
  roles?: { manager?: string };
  assets?: { address: string; symbol?: string; strategies?: { name: string }[] }[];
  totalManagedFunds?: { idle_amount?: string; invested_amount?: string }[];
}

export type { MockVault };
