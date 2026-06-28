import { randomUUID } from "node:crypto";
import { type Logger, fromBaseUnits, applyBps } from "@contexta/shared";
import type { AgentDecision, Country } from "@contexta/shared";
import type { Repository } from "../db/repository.js";
import type { TreasuryService, TreasurySnapshot } from "./treasuryService.js";
import type { PayrollService, UpcomingObligation } from "./payrollService.js";
import type { Oracle } from "../integrations/oracle.js";
import type { LegalContextService } from "./legalContextService.js";
import type { AuditService } from "./auditService.js";

export interface RebalancePlan {
  action: AgentDecision["action"];
  rationale: string;
  payload: Record<string, unknown>;
}

/** Planning horizon: obligations due within this many days drive liquidity need. */
const LIQUIDITY_HORIZON_DAYS = 7;
/** Default yield vault the agent moves excess liquidity into. */
const DEFAULT_YIELD_VAULT = "vault_cetes_rwa_001";
/** Heartbeat size (bps of total) for the band-rebalance cycle that keeps the
 *  agent actively settling on-chain even when the treasury is within target. */
const HEARTBEAT_BPS = 100;

/**
 * The agent. This is the orchestration layer — deterministic, auditable, and
 * intentionally free of any embedded LLM. An external AI system can be plugged
 * in at `plan()` to refine the proposal, but the platform never lets it bypass
 * the risk constraints or the legal-context binding enforced on execution.
 */
export class AgentService {
  constructor(
    private readonly repo: Repository,
    private readonly treasury: TreasuryService,
    private readonly payroll: PayrollService,
    private readonly oracle: Oracle,
    private readonly legal: LegalContextService,
    private readonly audit: AuditService,
    private readonly logger: Logger,
  ) {}

  /**
   * Pure-ish planner: given the current snapshot, obligations and FX volatility,
   * decide whether to move excess liquidity into yield or pull yield back to
   * cover upcoming payroll. Returns a single best action (or noop).
   */
  async plan(tenantId: string, country: Country): Promise<RebalancePlan> {
    const [snapshot, obligations, fx] = await Promise.all([
      this.treasury.snapshot(tenantId),
      this.payroll.upcomingObligations(tenantId),
      this.oracle.getFx(country),
    ]);

    if (!snapshot.config) {
      return { action: "noop", rationale: "No treasury config; nothing to plan.", payload: {} };
    }

    const liquid = BigInt(snapshot.totals.liquidBaseUnits);
    const total = BigInt(snapshot.totals.totalBaseUnits);
    const minLiquidity = BigInt(snapshot.config.minLiquidityBaseUnits);

    // Near-term obligations within the horizon.
    const horizonCutoff = Date.now() + LIQUIDITY_HORIZON_DAYS * 86_400_000;
    const nearObligations = obligations.filter(
      (o) => new Date(o.nextRunAt).getTime() <= horizonCutoff,
    );
    const obligationSum = nearObligations.reduce((acc, o) => acc + BigInt(o.requiredBaseUnits), 0n);

    // Volatility raises the required buffer: sensitivity (0–100) scaled by FX vol.
    const volBufferBps = Math.round(snapshot.config.volatilitySensitivity * fx.volatility * 100);
    const volBuffer = applyBps(obligationSum > 0n ? obligationSum : minLiquidity, volBufferBps);
    const requiredLiquidity = bigMax(minLiquidity, obligationSum) + volBuffer;

    // Cap on how much may sit in yield.
    const maxYield = applyBps(total, snapshot.config.maxYieldBps);
    const currentYield = BigInt(snapshot.totals.yieldBaseUnits);

    if (liquid > requiredLiquidity) {
      const excess = liquid - requiredLiquidity;
      const yieldRoom = maxYield > currentYield ? maxYield - currentYield : 0n;
      const moveAmount = bigMin(excess, yieldRoom);
      if (moveAmount > 0n) {
        return {
          action: "deposit_vault",
          rationale:
            `Liquid ${fromBaseUnits(liquid)} exceeds required ${fromBaseUnits(requiredLiquidity)} ` +
            `(payroll due ${fromBaseUnits(obligationSum)} + ${fromBaseUnits(volBuffer)} ${fx.pair} ` +
            `volatility buffer). Allocating ${fromBaseUnits(moveAmount)} to CETES vault for yield.`,
          payload: this.movePayload("liquidity", "defindex_vault", moveAmount, fx),
        };
      }
      // At the yield cap — fall through to the band heartbeat below.
    } else if (liquid < requiredLiquidity && currentYield > 0n) {
      const shortfall = requiredLiquidity - liquid;
      const moveAmount = bigMin(shortfall, currentYield);
      return {
        action: "withdraw_vault",
        rationale:
          `Liquid ${fromBaseUnits(liquid)} below required ${fromBaseUnits(requiredLiquidity)} ` +
          `for upcoming payroll. Withdrawing ${fromBaseUnits(moveAmount)} from CETES vault to cover obligations.`,
        payload: this.movePayload("defindex_vault", "liquidity", moveAmount, fx),
      };
    }

    // Band rebalance heartbeat: keep funds actively cycling inside the safe band
    // (above the liquidity floor, below the yield cap) so the agent is always
    // working and settling a real on-chain transaction every cycle.
    const heartbeat = bigMax(applyBps(total, HEARTBEAT_BPS), 1n);
    const yieldHeadroom = maxYield > currentYield ? maxYield - currentYield : 0n;
    const liquidHeadroom = liquid > requiredLiquidity ? liquid - requiredLiquidity : 0n;
    if (yieldHeadroom >= heartbeat && liquidHeadroom >= heartbeat) {
      return {
        action: "deposit_vault",
        rationale: `Band rebalance: moving ${fromBaseUnits(heartbeat)} into yield, keeping allocation inside the target band.`,
        payload: this.movePayload("liquidity", "defindex_vault", heartbeat, fx),
      };
    }
    if (currentYield >= heartbeat) {
      return {
        action: "withdraw_vault",
        rationale: `Band rebalance: returning ${fromBaseUnits(heartbeat)} to the liquid reserve, keeping allocation inside the target band.`,
        payload: this.movePayload("defindex_vault", "liquidity", heartbeat, fx),
      };
    }

    return {
      action: "noop",
      rationale: "Treasury within the target band and at its limits; holding this cycle.",
      payload: { liquid: fromBaseUnits(liquid), requiredLiquidity: fromBaseUnits(requiredLiquidity) },
    };
  }

  private movePayload(
    from: "liquidity" | "defindex_vault" | "blend_pool",
    to: "liquidity" | "defindex_vault" | "blend_pool",
    amount: bigint,
    fx: { pair: string; rate: number; volatility: number },
  ): Record<string, unknown> {
    return {
      from,
      to,
      asset: "USDC",
      amountBaseUnits: amount.toString(),
      amount: fromBaseUnits(amount),
      strategyRef: DEFAULT_YIELD_VAULT,
      fx: { pair: fx.pair, rate: fx.rate, volatility: fx.volatility },
    };
  }

  /** Persist a plan as a proposed decision (status: proposed). */
  async propose(tenantId: string, country: Country): Promise<AgentDecision> {
    const plan = await this.plan(tenantId, country);
    const current = await this.legal.getForTenant(tenantId);
    const decision: AgentDecision = {
      id: randomUUID(),
      tenantId,
      action: plan.action,
      rationale: plan.rationale,
      payload: plan.payload,
      status: "proposed",
      legalContextId: current?.document.contextId ?? null,
      legalContextHash: current?.hash ?? null,
      stellarTxHash: null,
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    const saved = await this.repo.insertDecision(decision);
    this.logger.info({ tenantId, decisionId: saved.id, action: saved.action }, "Agent proposed decision");
    await this.audit.record({
      tenantId,
      actorId: null,
      actorType: "agent",
      action: "agent.decision.proposed",
      detail: { decisionId: saved.id, action: saved.action },
      legalContextId: saved.legalContextId,
    });
    return saved;
  }

  /**
   * Approve + execute a previously proposed decision. Re-binds the legal context
   * at execution time so a stale proposal cannot settle under outdated terms.
   */
  async execute(
    tenantId: string,
    decision: AgentDecision,
    actorId: string | null,
    actorType: "user" | "agent",
  ): Promise<AgentDecision> {
    if (decision.action === "noop") {
      await this.repo.updateDecision(decision.id, {
        status: "executed",
        decidedAt: new Date().toISOString(),
      });
      return { ...decision, status: "executed" };
    }

    const p = decision.payload as {
      from: "liquidity" | "defindex_vault" | "blend_pool";
      to: "liquidity" | "defindex_vault" | "blend_pool";
      asset: string;
      amountBaseUnits: string;
      strategyRef: string;
    };

    const { txHash, legalContextHash } = await this.treasury.rebalance({
      tenantId,
      from: p.from,
      to: p.to,
      asset: p.asset,
      amountBaseUnits: p.amountBaseUnits,
      strategyRef: p.strategyRef,
      actorId,
      actorType,
    });

    await this.repo.updateDecision(decision.id, {
      status: "executed",
      stellarTxHash: txHash,
      legalContextHash,
      decidedAt: new Date().toISOString(),
    });
    await this.audit.record({
      tenantId,
      actorId,
      actorType,
      action: "agent.decision.approved",
      detail: { decisionId: decision.id, txHash },
      legalContextId: decision.legalContextId,
    });
    return { ...decision, status: "executed", stellarTxHash: txHash, legalContextHash };
  }

  listDecisions(tenantId: string): Promise<AgentDecision[]> {
    return this.repo.listDecisions(tenantId);
  }
}

function bigMax(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}
function bigMin(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export type { TreasurySnapshot, UpcomingObligation };
