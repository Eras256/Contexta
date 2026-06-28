import { type Logger, type Result, ok, tryAsync } from "@contexta/shared";
import { createBlendMock, type BlendMock, type BlendPosition } from "@contexta/tests/mocks";

/**
 * Blend Protocol integration (lending/borrowing). When pool contract ids are
 * configured the platform would build Soroban invocations against the published
 * Blend testnet contracts (submit / claim / get_positions). Without them, the
 * deterministic mock keeps the demo flow working.
 *
 * Blend docs: https://docs.blend.capital
 */
export interface BlendConfig {
  poolId?: string;
  oracleId?: string;
}

export class BlendClient {
  private readonly mock: BlendMock | null;

  constructor(
    private readonly config: BlendConfig,
    private readonly logger: Logger,
  ) {
    this.mock = config.poolId ? null : createBlendMock();
    if (this.mock) {
      this.logger.warn("BLEND_POOL_CONTRACT_ID not set — using in-memory Blend mock");
    }
  }

  get live(): boolean {
    return this.mock === null;
  }

  get poolId(): string {
    return this.config.poolId ?? "blend_pool_main";
  }

  async getPosition(asset: string): Promise<Result<BlendPosition>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(() => mock.getPosition(this.poolId, asset));
    }
    // Live: would simulate the Blend pool `get_positions` view via SorobanGateway.
    this.logger.info({ pool: this.poolId, asset }, "Blend getPosition (live path stub)");
    return ok({
      poolId: this.poolId,
      asset,
      suppliedBaseUnits: "0",
      borrowedBaseUnits: "0",
      supplyApyBps: 540,
      borrowApyBps: 1180,
    });
  }

  async supply(asset: string, amountBaseUnits: string): Promise<Result<BlendPosition>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(() => mock.supply(this.poolId, asset, amountBaseUnits));
    }
    this.logger.info({ pool: this.poolId, asset, amountBaseUnits }, "Blend supply (live path stub)");
    return tryAsync(() => createBlendMock().supply(this.poolId, asset, amountBaseUnits));
  }

  async withdraw(asset: string, amountBaseUnits: string): Promise<Result<BlendPosition>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(() => mock.withdraw(this.poolId, asset, amountBaseUnits));
    }
    this.logger.info({ pool: this.poolId, asset, amountBaseUnits }, "Blend withdraw (live path stub)");
    return tryAsync(() => createBlendMock().withdraw(this.poolId, asset, amountBaseUnits));
  }
}

export type { BlendPosition };
