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

  /**
   * Public, read-only status of the LLM that powers the agent's reasoning. Lets
   * the UI show (and the navbar selector reflect) which AI is live. Exposes no
   * secrets — only provider + model when configured.
   */
  router.get("/ai", (req, res) => {
    const ai = req.container.ai;
    res.setHeader("cache-control", "public, max-age=30");
    res.json({
      live: ai.live,
      provider: ai.live ? ai.provider : "none",
      model: ai.live ? ai.model : null,
    });
  });

  /** Live XLM/USD price from the Reflector on-chain oracle (SEP-40) — powers the
   *  treasury's USD valuation. Read-only, public. */
  router.get("/oracle", async (req, res, next) => {
    try {
      const r = req.container.reflector;
      const xlmUsd = await r.getUsdPrice("XLM");
      res.setHeader("cache-control", "public, max-age=12");
      res.json({
        live: xlmUsd != null,
        provider: "reflector",
        network: env().STELLAR_NETWORK,
        source: r.source,
        prices: { XLM: xlmUsd },
      });
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

  /**
   * Public, read-only SEP-24 off-ramp anchor capabilities (SEP-1 toml + SEP-24
   * /info). Shows the real testnet anchor the platform would use to off-ramp USDC
   * to local rails (PIX/Bre-B in production). Read-only — moves no funds.
   */
  router.get("/anchor", async (_req, res, next) => {
    try {
      const base = env().ANCHOR_SEP24_URL.replace(/\/$/, "");
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const toml = await (await fetch(`${base}/.well-known/stellar.toml`, { signal: ctrl.signal })).text();
        const grab = (k: string) => toml.match(new RegExp(`${k}\\s*=\\s*"([^"]+)"`))?.[1] ?? null;
        const transferServer = grab("TRANSFER_SERVER_SEP0024");
        const webAuth = grab("WEB_AUTH_ENDPOINT");
        let withdraw: string[] = [];
        let deposit: string[] = [];
        if (transferServer) {
          const info = (await (await fetch(`${transferServer.replace(/\/$/, "")}/info`, { signal: ctrl.signal })).json()) as {
            withdraw?: Record<string, unknown>;
            deposit?: Record<string, unknown>;
          };
          withdraw = Object.keys(info.withdraw ?? {});
          deposit = Object.keys(info.deposit ?? {});
        }
        res.setHeader("cache-control", "public, max-age=300");
        res.json({
          live: Boolean(transferServer),
          anchor: base.replace(/^https?:\/\//, ""),
          transferServer,
          webAuth,
          protocols: ["SEP-1", "SEP-10", "SEP-24"],
          withdraw,
          deposit,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      next(e);
    }
  });

  /**
   * Start a REAL SEP-24 off-ramp on testnet: SEP-10 auth (challenge → sign →
   * JWT) + SEP-24 interactive withdraw → the anchor's hosted off-ramp URL. This
   * is the genuine mechanism that settles to PIX/Bre-B via a licensed anchor in
   * production. No funds move here — KYC + amount happen on the anchor's page.
   */
  router.get("/anchor/withdraw", async (req, res) => {
    try {
      const asset = typeof req.query.asset === "string" ? req.query.asset : "USDC";
      const r = await req.container.anchor.initiateWithdraw(asset);
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  return router;
}
