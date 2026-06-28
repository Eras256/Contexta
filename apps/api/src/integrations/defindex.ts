import { type Logger, type Result, ok, err, tryAsync } from "@contexta/shared";
import { createDefindexMock, type DefindexMock, type MockVault } from "@contexta/tests/mocks";

/**
 * DeFindex integration. When an API key is configured we talk to the live
 * DeFindex REST API; otherwise we fall back to the deterministic in-memory mock
 * so the platform (and the hackathon demo) runs end-to-end with no external
 * dependency. The interface is identical in both modes.
 *
 * DeFindex docs: https://docs.defindex.io
 */
export interface DefindexConfig {
  apiUrl: string;
  apiKey?: string;
}

export interface Vault {
  vaultId: string;
  name: string;
  asset: string;
  strategy: string;
  apyBps: number;
  tvlBaseUnits: string;
}

export class DefindexClient {
  private readonly mock: DefindexMock | null;

  constructor(
    private readonly config: DefindexConfig,
    private readonly logger: Logger,
  ) {
    this.mock = config.apiKey ? null : createDefindexMock();
    if (this.mock) {
      this.logger.warn("DEFINDEX_API_KEY not set — using in-memory DeFindex mock");
    }
  }

  get live(): boolean {
    return this.mock === null;
  }

  async listVaults(): Promise<Result<Vault[]>> {
    if (this.mock) return ok((await this.mock.listVaults()) as Vault[]);
    return tryAsync(() => this.request<Vault[]>("GET", "/vaults"));
  }

  async createVault(input: {
    name: string;
    asset: string;
    strategy: string;
  }): Promise<Result<Vault>> {
    if (this.mock) return ok((await this.mock.createVault(input)) as Vault);
    return tryAsync(() => this.request<Vault>("POST", "/vaults", input));
  }

  /**
   * Deposit into a vault. DeFindex calls can fail with TTL-extension gas spikes
   * or MissingValue errors when a vault's storage entries have expired; we
   * surface those as a Result rather than throwing so the agent can back off
   * and retry on the next tick instead of crashing the loop.
   */
  async deposit(vaultId: string, amountBaseUnits: string): Promise<Result<{ tvlBaseUnits: string }>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(async () => {
        const r = await mock.deposit(vaultId, amountBaseUnits);
        return { tvlBaseUnits: r.tvlBaseUnits };
      });
    }
    const res = await tryAsync(() =>
      this.request<{ tvlBaseUnits: string }>("POST", `/vaults/${vaultId}/deposit`, {
        amount: amountBaseUnits,
      }),
    );
    if (!res.ok && /MissingValue|TTL|trustline/i.test(res.error.message)) {
      this.logger.warn({ vaultId, error: res.error.message }, "DeFindex deposit recoverable error");
      return err(new Error(`DeFindex deposit deferred: ${res.error.message}`));
    }
    return res;
  }

  async withdraw(vaultId: string, amountBaseUnits: string): Promise<Result<{ tvlBaseUnits: string }>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(async () => {
        const r = await mock.withdraw(vaultId, amountBaseUnits);
        return { tvlBaseUnits: r.tvlBaseUnits };
      });
    }
    return tryAsync(() =>
      this.request<{ tvlBaseUnits: string }>("POST", `/vaults/${vaultId}/withdraw`, {
        amount: amountBaseUnits,
      }),
    );
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
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

export type { MockVault };
