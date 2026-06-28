import { randomUUID } from "node:crypto";
import { type Logger, fromBaseUnits } from "@contexta/shared";
import type { TreasuryConfig, TreasuryPosition } from "@contexta/shared";
import type { Repository } from "../db/repository.js";
import type { DefindexClient } from "../integrations/defindex.js";
import type { BlendClient } from "../integrations/blend.js";
import type { SorobanGateway } from "../integrations/soroban.js";
import type { LegalContextService } from "./legalContextService.js";
import type { AuditService } from "./auditService.js";

export interface TreasurySnapshot {
  config: TreasuryConfig | null;
  positions: TreasuryPosition[];
  totals: {
    liquidBaseUnits: string;
    yieldBaseUnits: string;
    totalBaseUnits: string;
    yieldShareBps: number;
  };
}

export interface RebalanceRequest {
  tenantId: string;
  from: "liquidity" | "defindex_vault" | "blend_pool";
  to: "liquidity" | "defindex_vault" | "blend_pool";
  asset: string;
  amountBaseUnits: string;
  strategyRef: string;
  actorId: string | null;
  actorType: "user" | "agent";
}

/**
 * Treasury domain logic: aggregate balances across liquidity / DeFindex /
 * Blend, and execute rebalances that move value between them. Every rebalance
 * is bound to the tenant's legal context before any external/on-chain effect.
 */
export class TreasuryService {
  constructor(
    private readonly repo: Repository,
    private readonly defindex: DefindexClient,
    private readonly blend: BlendClient,
    private readonly soroban: SorobanGateway,
    private readonly legal: LegalContextService,
    private readonly audit: AuditService,
    private readonly logger: Logger,
  ) {}

  async snapshot(tenantId: string): Promise<TreasurySnapshot> {
    const [config, positions] = await Promise.all([
      this.repo.getTreasuryConfig(tenantId),
      this.repo.listPositions(tenantId),
    ]);

    let liquid = 0n;
    let yieldUnits = 0n;
    for (const p of positions) {
      const amt = BigInt(p.amountBaseUnits);
      if (p.strategy === "liquidity") liquid += amt;
      else yieldUnits += amt;
    }
    const total = liquid + yieldUnits;
    const yieldShareBps = total === 0n ? 0 : Number((yieldUnits * 10_000n) / total);

    return {
      config,
      positions,
      totals: {
        liquidBaseUnits: liquid.toString(),
        yieldBaseUnits: yieldUnits.toString(),
        totalBaseUnits: total.toString(),
        yieldShareBps,
      },
    };
  }

  async saveConfig(
    config: Omit<TreasuryConfig, "id" | "updatedAt"> & { id?: string },
    actorId: string | null,
  ): Promise<TreasuryConfig> {
    const existing = await this.repo.getTreasuryConfig(config.tenantId);
    const saved = await this.repo.upsertTreasuryConfig({
      ...config,
      id: existing?.id ?? config.id ?? randomUUID(),
      updatedAt: new Date().toISOString(),
    });
    await this.audit.record({
      tenantId: config.tenantId,
      actorId,
      actorType: "user",
      action: "treasury.configured",
      detail: { maxYieldBps: saved.maxYieldBps, minLiquidity: saved.minLiquidityBaseUnits },
    });
    return saved;
  }

  /**
   * Execute a rebalance: move `amount` from one strategy bucket to another.
   * Enforces the legal-context binding, performs the integration call
   * (DeFindex/Blend), records the on-chain treasury event, and updates positions.
   */
  async rebalance(req: RebalanceRequest): Promise<{ txHash: string; legalContextHash: string }> {
    const binding = await this.legal.bindForAction(req.tenantId, [
      "treasury-management",
    ]);

    // 1. Integration side-effects (mocked or live).
    if (req.to === "defindex_vault") {
      const r = await this.defindex.deposit(req.strategyRef, req.amountBaseUnits);
      if (!r.ok) throw r.error;
    } else if (req.from === "defindex_vault") {
      const r = await this.defindex.withdraw(req.strategyRef, req.amountBaseUnits);
      if (!r.ok) throw r.error;
    }
    if (req.to === "blend_pool") {
      const r = await this.blend.supply(req.asset, req.amountBaseUnits);
      if (!r.ok) throw r.error;
    } else if (req.from === "blend_pool") {
      const r = await this.blend.withdraw(req.asset, req.amountBaseUnits);
      if (!r.ok) throw r.error;
    }

    // 2. On-chain record with the LCP hash bound into the event.
    const direction = req.to === "liquidity" ? "withdraw" : "deposit";
    const onchain = await this.soroban.recordTreasuryFlow(direction, {
      tenantId: req.tenantId,
      asset: req.asset,
      amountBaseUnits: req.amountBaseUnits,
      strategyRef: req.strategyRef,
      binding,
    });
    if (!onchain.ok) throw onchain.error;

    // 3. Persist new position balances.
    await this.applyPositionDelta(req.tenantId, req.from, req.asset, req.strategyRef, -BigInt(req.amountBaseUnits));
    await this.applyPositionDelta(req.tenantId, req.to, req.asset, req.strategyRef, BigInt(req.amountBaseUnits));

    await this.audit.record({
      tenantId: req.tenantId,
      actorId: req.actorId,
      actorType: req.actorType,
      action: "treasury.rebalanced",
      detail: {
        from: req.from,
        to: req.to,
        asset: req.asset,
        amount: fromBaseUnits(BigInt(req.amountBaseUnits)),
        txHash: onchain.value.txHash,
      },
      legalContextId: binding.contextId,
    });

    this.logger.info(
      { tenantId: req.tenantId, txHash: onchain.value.txHash, from: req.from, to: req.to },
      "Treasury rebalanced",
    );
    return { txHash: onchain.value.txHash, legalContextHash: binding.hash };
  }

  private async applyPositionDelta(
    tenantId: string,
    strategy: TreasuryPosition["strategy"],
    asset: string,
    strategyRef: string,
    delta: bigint,
  ): Promise<void> {
    const positions = await this.repo.listPositions(tenantId);
    const match = positions.find(
      (p) => p.strategy === strategy && p.asset === asset && (p.strategyRef ?? "") === (strategy === "liquidity" ? "" : strategyRef),
    );
    const current = match ? BigInt(match.amountBaseUnits) : 0n;
    const next = current + delta;
    if (next < 0n) throw new Error(`Rebalance would make ${strategy} balance negative`);
    await this.repo.upsertPosition({
      id: match?.id ?? randomUUID(),
      tenantId,
      asset: asset as TreasuryPosition["asset"],
      strategy,
      strategyRef: strategy === "liquidity" ? null : strategyRef,
      amountBaseUnits: next.toString(),
      apyBps: match?.apyBps ?? null,
      updatedAt: new Date().toISOString(),
    });
  }
}
