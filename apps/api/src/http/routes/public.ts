import { Router } from "express";
import { env } from "../../env.js";

/**
 * Public, unauthenticated read of the autonomous agent's recent activity for the
 * demo tenant — powers the Home live feed. Returns only sanitized, non-sensitive
 * fields. Rate-limited at the mount point.
 */
export function publicRouter(): Router {
  const router = Router();

  router.get("/activity", async (req, res, next) => {
    try {
      const config = env();
      const base = {
        agentAddress: config.AGENT_PUBLIC_ADDRESS || null,
        network: config.STELLAR_NETWORK,
        contracts: {
          treasury: config.TREASURY_CONTRACT_ID || null,
          payroll: config.PAYROLL_CONTRACT_ID || null,
        },
      };
      const tenantId = config.AUTH_DEMO_TENANT_ID;
      if (!tenantId) {
        res.json({ ...base, decisions: [] });
        return;
      }
      const all = await req.container.repo.listDecisions(tenantId);
      const decisions = all.slice(0, 12).map((d) => ({
        id: d.id,
        action: d.action,
        rationale: d.rationale,
        status: d.status,
        stellarTxHash: d.stellarTxHash,
        legalContextHash: d.legalContextHash,
        createdAt: d.createdAt,
      }));
      res.setHeader("cache-control", "public, max-age=5");
      res.json({ ...base, decisions });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
