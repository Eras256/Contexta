import { Router } from "express";
import { requireCapability } from "../middleware/rbac.js";
import { requireCtx } from "../context.js";
import { rebalanceSchema, treasuryConfigSchema } from "../schemas.js";

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

  return router;
}
