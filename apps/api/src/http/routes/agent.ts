import { Router, type Request } from "express";
import { requireCapability } from "../middleware/rbac.js";
import { requireCtx, HttpError } from "../context.js";
import { proposeSchema } from "../schemas.js";

/**
 * Autonomous runs (the worker, `ctx.isAgent`) are suppressed when the tenant
 * has flipped the dashboard agent toggle off. Manual runs (a signed-in user)
 * always proceed — the toggle governs autonomy, not the human override.
 */
async function autonomyDisabled(req: Request, tenantId: string, isAgent: boolean): Promise<boolean> {
  if (!isAgent) return false;
  const cfg = await req.container.repo.getTreasuryConfig(tenantId);
  return Boolean(cfg && cfg.agentEnabled === false);
}

export function agentRouter(): Router {
  const router = Router();

  router.get("/decisions", requireCapability("agent.read"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      res.json(await req.container.agent.listDecisions(ctx.tenantId));
    } catch (e) {
      next(e);
    }
  });

  /**
   * Ask the agent to evaluate the treasury and produce a proposal. With
   * `execute: true` (and sufficient role) the proposal is also settled — this is
   * the path the worker uses on its polling tick when AGENT_DRY_RUN is false.
   */
  router.post("/propose", requireCapability("agent.configure"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      if (await autonomyDisabled(req, ctx.tenantId, ctx.isAgent)) {
        res.json({ skipped: true, reason: "agent_disabled" });
        return;
      }
      const body = proposeSchema.parse(req.body);
      const tenant = await req.container.repo.getTenant(ctx.tenantId);
      const decision = await req.container.agent.propose(ctx.tenantId, tenant.country, {
        aiProvider: body.aiProvider,
        aiModel: body.aiModel,
        aiApiKey: body.aiApiKey,
        locale: body.locale,
      });

      if (body.execute && decision.action !== "noop") {
        try {
          const executed = await req.container.agent.execute(
            ctx.tenantId,
            decision,
            ctx.userId,
            ctx.isAgent ? "agent" : "user",
          );
          res.json(executed);
        } catch (execErr) {
          // The proposal is already recorded; execution couldn't settle this
          // cycle (e.g. insufficient bucket, slow tx). Surface it as a clean
          // result instead of a 500 — the move can settle later via Realtime.
          req.container.logger.warn(
            { err: execErr instanceof Error ? execErr.message : String(execErr) },
            "Agent execute failed after proposal",
          );
          res.json({
            ...decision,
            executionError: execErr instanceof Error ? execErr.message : String(execErr),
          });
        }
        return;
      }
      res.json(decision);
    } catch (e) {
      next(e);
    }
  });

  /**
   * Run one real DeFindex yield cycle (deposit/withdraw a fixed step into the
   * platform's live vault, recording an executed decision with the tx). Routed
   * here so the worker can drive it on a slow cadence via the internal secret.
   */
  router.post("/yield-cycle", requireCapability("treasury.rebalance"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      if (await autonomyDisabled(req, ctx.tenantId, ctx.isAgent)) {
        res.json({ skipped: true, reason: "agent_disabled" });
        return;
      }
      const decision = await req.container.agent.runYieldCycle(ctx.tenantId);
      res.json(decision ?? { skipped: true });
    } catch (e) {
      next(e);
    }
  });

  /** Run one real Blend lending cycle (supply/withdraw a fixed step). */
  router.post("/blend-cycle", requireCapability("treasury.rebalance"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      if (await autonomyDisabled(req, ctx.tenantId, ctx.isAgent)) {
        res.json({ skipped: true, reason: "agent_disabled" });
        return;
      }
      const decision = await req.container.agent.runBlendCycle(ctx.tenantId);
      res.json(decision ?? { skipped: true });
    } catch (e) {
      next(e);
    }
  });

  router.post("/decisions/:id/execute", requireCapability("treasury.rebalance"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const decisions = await req.container.agent.listDecisions(ctx.tenantId);
      const decision = decisions.find((d) => d.id === req.params.id);
      if (!decision) throw new HttpError(404, "Decision not found");
      if (decision.status !== "proposed") {
        throw new HttpError(409, `Decision already ${decision.status}`);
      }
      const executed = await req.container.agent.execute(
        ctx.tenantId,
        decision,
        ctx.userId,
        ctx.isAgent ? "agent" : "user",
      );
      res.json(executed);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
