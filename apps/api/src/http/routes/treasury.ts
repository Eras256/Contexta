import { Router } from "express";
import { requireCapability } from "../middleware/rbac.js";
import { requireCtx, HttpError } from "../context.js";
import {
  agentToggleSchema,
  prepareMoveSchema,
  rebalanceSchema,
  submitMoveSchema,
  treasuryConfigSchema,
} from "../schemas.js";

export function treasuryRouter(): Router {
  const router = Router();

  router.get("/", requireCapability("treasury.read"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      res.json(await req.container.treasury.snapshot(ctx.tenantId));
    } catch (e) {
      next(e);
    }
  });

  router.put("/config", requireCapability("treasury.configure"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const body = treasuryConfigSchema.parse(req.body);
      const saved = await req.container.treasury.saveConfig(
        { tenantId: ctx.tenantId, ...body },
        ctx.userId,
      );
      res.json(saved);
    } catch (e) {
      next(e);
    }
  });

  // Activate / deactivate the autonomous agent for this tenant (dashboard toggle).
  router.post("/agent", requireCapability("treasury.configure"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const { enabled } = agentToggleSchema.parse(req.body);
      const saved = await req.container.treasury.setAgentEnabled(ctx.tenantId, enabled, ctx.userId);
      res.json({ agentEnabled: saved.agentEnabled });
    } catch (e) {
      next(e);
    }
  });

  router.post("/rebalance", requireCapability("treasury.rebalance"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const body = rebalanceSchema.parse(req.body);
      const result = await req.container.treasury.rebalance({
        tenantId: ctx.tenantId,
        ...body,
        actorId: ctx.userId,
        actorType: ctx.isAgent ? "agent" : "user",
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  // ── Self-custody (user-signed) Blend move ────────────────────────────────
  // 1) Build an unsigned tx the user signs in their own wallet (Freighter).
  router.post("/prepare", requireCapability("treasury.rebalance"), async (req, res, next) => {
    try {
      requireCtx(req);
      const b = prepareMoveSchema.parse(req.body);
      if (!req.container.blend.live) throw new HttpError(400, "Blend is not live; cannot prepare a self-custody move.");
      const xdr = await req.container.blend.buildRequestXdr(b.address, b.direction, b.asset, b.amountBaseUnits);
      res.json({ xdr });
    } catch (e) {
      next(e);
    }
  });

  // 2) Submit the user-signed envelope. LCP-bound + audited, like every settle.
  router.post("/submit", requireCapability("treasury.rebalance"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const { signedXdr } = submitMoveSchema.parse(req.body);
      const binding = await req.container.legal.bindForAction(ctx.tenantId, ["treasury-management"]);
      const r = await req.container.blend.submitSignedXdr(signedXdr);
      await req.container.audit.record({
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        actorType: "user",
        action: "treasury.rebalanced",
        detail: { txHash: r.txHash, selfCustody: true },
        legalContextId: binding.contextId,
      });
      res.json({ txHash: r.txHash, legalContextHash: binding.hash });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
