import { Router } from "express";
import { requireCapability } from "../middleware/rbac.js";
import { requireCtx } from "../context.js";
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

  // ── Self-custody (user-signed) move ──────────────────────────────────────
  // 1) Build an unsigned tx the user signs in their own wallet (Freighter).
  router.post("/prepare", requireCapability("treasury.rebalance"), async (req, res, next) => {
    try {
      requireCtx(req);
      const b = prepareMoveSchema.parse(req.body);
      let xdr: string;
      try {
        if (b.venue === "defindex") {
          if (!req.container.defindex.live) throw new Error("DeFindex is not live.");
          xdr = await req.container.defindex.buildUserXdr(
            b.address,
            b.direction === "supply" ? "deposit" : "withdraw",
            b.amountBaseUnits,
          );
        } else {
          if (!req.container.blend.live) throw new Error("Blend is not live.");
          xdr = await req.container.blend.buildRequestXdr(b.address, b.direction, b.asset, b.amountBaseUnits);
        }
      } catch (opErr) {
        // Surface the on-chain/upstream reason (the generic handler hides it).
        res.status(400).json({ error: opErr instanceof Error ? opErr.message : String(opErr) });
        return;
      }
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
      let txHash: string;
      try {
        const r = await req.container.blend.submitSignedXdr(signedXdr);
        txHash = r.txHash;
      } catch (opErr) {
        res.status(400).json({ error: opErr instanceof Error ? opErr.message : String(opErr) });
        return;
      }
      await req.container.audit.record({
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        actorType: "user",
        action: "treasury.rebalanced",
        detail: { txHash, selfCustody: true },
        legalContextId: binding.contextId,
      });
      res.json({ txHash, legalContextHash: binding.hash });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
