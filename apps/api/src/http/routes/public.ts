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

  /**
   * Public, read-only snapshot of the live DeFindex vault the platform uses for
   * real yield (APY, TVL, our position). Powers the Integrations page. Returns
   * { live:false } when DeFindex runs in mock mode.
   */
  router.get("/defindex", async (req, res, next) => {
    try {
      const dfx = req.container.defindex;
      if (!dfx.live) {
        res.json({ live: false });
        return;
      }
      const r = await dfx.getVaultData();
      res.setHeader("cache-control", "public, max-age=30");
      if (!r.ok) {
        res.json({ live: true, vault: null, error: r.error.message });
        return;
      }
      res.json({ live: true, vault: r.value });
    } catch (e) {
      next(e);
    }
  });

  /** Public, read-only snapshot of the live Blend pool reserve the platform lends into. */
  router.get("/blend", async (req, res, next) => {
    try {
      const blend = req.container.blend;
      if (!blend.live) {
        res.json({ live: false });
        return;
      }
      const r = await blend.getVaultData();
      res.setHeader("cache-control", "public, max-age=30");
      res.json(r.ok ? { live: true, vault: r.value } : { live: true, vault: null, error: r.error.message });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
