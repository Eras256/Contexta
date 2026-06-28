import { type Logger, type Result, err, tryAsync, stellar } from "@contextio/shared";
import { createBlendMock, type BlendMock, type BlendPosition } from "@contextio/tests/mocks";
import { PoolV2, PoolContractV2, RequestType } from "@blend-capital/blend-sdk";

/**
 * Blend Protocol integration (lending). Blend has no hosted API — it's fully
 * on-chain. When a pool id + signer are configured we read live pool state with
 * the Blend SDK (`PoolV2.load`) and supply/withdraw by building the pool
 * `submit` operation (SDK) then signing + submitting it through our Soroban
 * RPC client. Without a pool id we fall back to the deterministic mock.
 *
 * Blend docs: https://docs.blend.capital
 */
const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

export interface BlendConfig {
  poolId?: string;
  oracleId?: string;
  backstopId?: string;
  /** Underlying asset to supply (defaults to native XLM SAC — no faucet needed). */
  asset?: string;
  rpcUrl?: string;
  networkPassphrase?: string;
  /** Platform Stellar secret that signs supply/withdraw transactions. */
  signerSecret?: string;
}

/** UI-facing snapshot of the live Blend pool reserve + the platform's position. */
export interface BlendVaultData {
  poolId: string;
  asset: string;
  supplyApyBps: number;
  tvlBaseUnits: string;
  positionBaseUnits: string;
  network: string;
}

export class BlendClient {
  private readonly mock: BlendMock | null;
  private readonly signerAddress: string | null;

  constructor(
    private readonly config: BlendConfig,
    private readonly stellarClient: stellar.StellarClient,
    private readonly logger: Logger,
  ) {
    this.mock = config.poolId ? null : createBlendMock();
    this.signerAddress = config.signerSecret
      ? stellar.Keypair.fromSecret(config.signerSecret).publicKey()
      : null;
    if (this.mock) {
      this.logger.warn("BLEND_POOL_CONTRACT_ID not set — using in-memory Blend mock");
    } else if (!this.signerAddress) {
      this.logger.warn("Blend pool set but signer missing — writes disabled, reads only");
    }
  }

  get live(): boolean {
    return this.mock === null;
  }

  get canWrite(): boolean {
    return this.live && !!this.config.signerSecret && !!this.signerAddress;
  }

  get poolId(): string {
    return this.config.poolId ?? "blend_pool_main";
  }

  private get assetId(): string {
    return this.config.asset ?? XLM_SAC;
  }

  private get net(): { rpc: string; passphrase: string } {
    return {
      rpc: this.config.rpcUrl ?? "https://soroban-testnet.stellar.org",
      passphrase: this.config.networkPassphrase ?? "Test SDF Network ; September 2015",
    };
  }

  async getPosition(asset: string): Promise<Result<BlendPosition>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(() => mock.getPosition(this.poolId, asset));
    }
    return tryAsync(async () => {
      const d = await this.loadVault(asset || this.assetId);
      return {
        poolId: this.poolId,
        asset: asset || this.assetId,
        suppliedBaseUnits: d.positionBaseUnits,
        borrowedBaseUnits: "0",
        supplyApyBps: d.supplyApyBps,
        borrowApyBps: 0,
      };
    });
  }

  /** Live reserve snapshot for the UI: APY, pool TVL, our supplied position. */
  async getVaultData(): Promise<Result<BlendVaultData>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(async () => {
        const p = await mock.getPosition(this.poolId, "USDC");
        return {
          poolId: this.poolId,
          asset: "USDC",
          supplyApyBps: p.supplyApyBps,
          tvlBaseUnits: p.suppliedBaseUnits,
          positionBaseUnits: p.suppliedBaseUnits,
          network: "mock",
        };
      });
    }
    return tryAsync(() => this.loadVault(this.assetId));
  }

  async supply(asset: string, amountBaseUnits: string): Promise<Result<BlendPosition & { txHash?: string }>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(() => mock.supply(this.poolId, asset, amountBaseUnits));
    }
    const res = await tryAsync(() => this.submitRequest(RequestType.Supply, asset || this.assetId, amountBaseUnits));
    if (!res.ok && /MissingValue|TTL|trustline|balance/i.test(res.error.message)) {
      this.logger.warn({ pool: this.poolId, error: res.error.message }, "Blend supply recoverable error");
      return err(new Error(`Blend supply deferred: ${res.error.message}`));
    }
    return res;
  }

  async withdraw(asset: string, amountBaseUnits: string): Promise<Result<BlendPosition & { txHash?: string }>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(() => mock.withdraw(this.poolId, asset, amountBaseUnits));
    }
    return tryAsync(() => this.submitRequest(RequestType.Withdraw, asset || this.assetId, amountBaseUnits));
  }

  // ── live helpers ──────────────────────────────────────────────────────────

  private async loadVault(asset: string): Promise<BlendVaultData> {
    const poolId = this.config.poolId as string;
    const pool = await PoolV2.load(this.net, poolId);
    const reserve = pool.reserves.get(asset);
    if (!reserve) throw new Error(`Blend pool ${poolId} has no reserve for ${asset}`);

    let positionBaseUnits = "0";
    if (this.signerAddress) {
      try {
        const user = await pool.loadUser(this.signerAddress);
        positionBaseUnits = user.getSupply(reserve).toString();
      } catch {
        /* user may have no position yet */
      }
    }
    const tvlBaseUnits = BigInt(Math.round(reserve.totalSupplyFloat() * 1e7)).toString();
    return {
      poolId,
      asset: asset === XLM_SAC ? "XLM" : (asset === "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU" ? "USDC" : asset),
      supplyApyBps: Math.round(reserve.estSupplyApy * 100),
      tvlBaseUnits,
      positionBaseUnits,
      network: this.net.passphrase.includes("Public") ? "mainnet" : "testnet",
    };
  }

  /** Build the Blend pool `submit` op (SDK), sign it, and submit via Soroban RPC. */
  private async submitRequest(
    requestType: RequestType,
    asset: string,
    amountBaseUnits: string,
  ): Promise<BlendPosition & { txHash?: string }> {
    if (!this.canWrite) throw new Error("Blend writes disabled (missing pool/signer)");
    const addr = this.signerAddress as string;
    const opXdr = new PoolContractV2(this.config.poolId as string).submit({
      from: addr,
      spender: addr,
      to: addr,
      requests: [{ amount: BigInt(amountBaseUnits), request_type: requestType, address: asset }],
    });
    const res = await this.stellarClient.submitOperationXdr(opXdr, this.config.signerSecret as string);
    const pos = await this.getPosition(asset);
    const base: BlendPosition = pos.ok
      ? pos.value
      : { poolId: this.poolId, asset, suppliedBaseUnits: "0", borrowedBaseUnits: "0", supplyApyBps: 0, borrowApyBps: 0 };
    return { ...base, txHash: res.txHash };
  }
}

export type { BlendPosition };
