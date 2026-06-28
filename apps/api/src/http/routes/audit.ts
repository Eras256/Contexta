import { Router } from "express";
import { requireCapability } from "../middleware/rbac.js";
import { requireCtx } from "../context.js";

export function auditRouter(): Router {
  const router = Router();

  router.get("/", requireCapability("audit.read"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      res.json(await req.container.audit.list(ctx.tenantId));
    } catch (e) {
      next(e);
    }
  });

  return router;
}
