import { stellar, type Logger } from "@contextio/shared";

/**
 * Public Reflector "external CEX/DEX" price oracle (SEP-40), base = USD.
 * Source: Stellar Docs → Data → Oracle Providers.
 */
const DEFAULT_PRICE_ORACLE: Record<string, string> = {
  testnet: "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63",
  mainnet: "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN",
  public: "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN",
};

export interface ReflectorConfig {
  network: string;
  priceOracleId?: string;
}

/**
 * Reads real on-chain prices from **Reflector** — Stellar's SEP-40 price oracle —
 * via read-only Soroban simulation (no fees, no signing). Used to value the
 * treasury in USD with a real market price instead of a hardcoded rate. Every
 * method degrades gracefully (returns `null`) so a slow/unavailable oracle never
 * breaks the dashboard.
 */
export class ReflectorClient {
  private readonly contractId: string;
  private decimalsCache: number | null = null;

  constructor(
    private readonly stellarClient: stellar.StellarClient,
    cfg: ReflectorConfig,
    private readonly logger: Logger,
  ) {
    this.contractId =
      cfg.priceOracleId ||
      DEFAULT_PRICE_ORACLE[cfg.network] ||
      "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63"; // testnet external oracle
  }

  get live(): boolean {
    return Boolean(this.contractId);
  }

  /** The oracle contract being read (for public proof / explorer links). */
  get source(): string {
    return this.contractId;
  }

  /** SEP-40 `decimals()` — cached. Reflector uses 14; fall back to that. */
  private async decimals(): Promise<number> {
    if (this.decimalsCache !== null) return this.decimalsCache;
    try {
      const d = await this.stellarClient.simulate({ contractId: this.contractId, method: "decimals" });
      this.decimalsCache = typeof d === "number" && d > 0 ? d : 14;
    } catch {
      this.decimalsCache = 14;
    }
    return this.decimalsCache;
  }

  /**
   * USD price of a ticker (e.g. "XLM", "USDC") from the external oracle, or null.
   * Reads SEP-40 `lastprice(Asset::Other(Symbol(ticker)))`.
   */
  async getUsdPrice(symbol: string): Promise<number | null> {
    try {
      const asset = stellar.xdr.ScVal.scvVec([
        stellar.nativeToScVal("Other", { type: "symbol" }),
        stellar.nativeToScVal(symbol, { type: "symbol" }),
      ]);
      const res = (await this.stellarClient.simulate({
        contractId: this.contractId,
        method: "lastprice",
        args: [asset],
      })) as { price?: bigint | string | number } | null;
      if (!res || res.price == null) return null;
      const decimals = await this.decimals();
      const price = Number(BigInt(res.price as bigint)) / 10 ** decimals;
      return Number.isFinite(price) && price > 0 ? price : null;
    } catch (e) {
      this.logger.warn({ err: String(e), symbol }, "Reflector price read failed; using fallback");
      return null;
    }
  }
}
