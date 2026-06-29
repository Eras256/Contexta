import { Router } from "express";
import { requireCapability } from "../middleware/rbac.js";
import { requireCtx } from "../context.js";
import { blendOpSchema, createVaultPrepareSchema, vaultCreateSchema } from "../schemas.js";

export function integrationsRouter(): Router {
  const router = Router();

  // ── DeFindex ───────────────────────────────────────────────────────────
  router.get("/defindex/vaults", requireCapability("integrations.manage"), async (req, res, next) => {
    try {
      const r = await req.container.defindex.listVaults();
      if (!r.ok) throw r.error;
      res.json({ live: req.container.defindex.live, vaults: r.value });
    } catch (e) {
      next(e);
    }
  });

  router.post("/defindex/vaults", requireCapability("integrations.manage"), async (req, res, next) => {
    try {
      const body = vaultCreateSchema.parse(req.body);
      const r = await req.container.defindex.createVault(body);
      if (!r.ok) throw r.error;
      res.status(201).json(r.value);
    } catch (e) {
      next(e);
    }
  });

  // Self-custody vault deploy: build an unsigned factory create-vault tx for the
  // user to sign in Freighter; submit via /treasury/submit. Returns the on-chain
  // error if the combo isn't deployable on testnet.
  router.post("/defindex/vaults/prepare", requireCapability("integrations.manage"), async (req, res, next) => {
    try {
      requireCtx(req);
      const b = createVaultPrepareSchema.parse(req.body);
      try {
        const xdr = await req.container.defindex.buildCreateVaultXdr(b.address, b.asset, b.name);
        res.json({ xdr });
      } catch (opErr) {
        res.status(400).json({ error: opErr instanceof Error ? opErr.message : String(opErr) });
      }
    } catch (e) {
      next(e);
    }
  });

  // ── Blend ──────────────────────────────────────────────────────────────
  router.get("/blend/position", requireCapability("integrations.manage"), async (req, res, next) => {
    try {
      const asset = (req.query.asset as string) ?? "USDC";
      const r = await req.container.blend.getPosition(asset);
      if (!r.ok) throw r.error;
      res.json({ live: req.container.blend.live, position: r.value });
    } catch (e) {
      next(e);
    }
  });

  router.post("/blend/supply", requireCapability("integrations.manage"), async (req, res, next) => {
    try {
      const body = blendOpSchema.parse(req.body);
      const r = await req.container.blend.supply(body.asset, body.amountBaseUnits);
      if (!r.ok) throw r.error;
      res.json(r.value);
    } catch (e) {
      next(e);
    }
  });

  router.post("/blend/withdraw", requireCapability("integrations.manage"), async (req, res, next) => {
    try {
      const body = blendOpSchema.parse(req.body);
      const r = await req.container.blend.withdraw(body.asset, body.amountBaseUnits);
      if (!r.ok) throw r.error;
      res.json(r.value);
    } catch (e) {
      next(e);
    }
  });

  // ── Stellar / network status ───────────────────────────────────────────
  router.get("/stellar/status", requireCapability("integrations.manage"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const health = await req.container.soroban.health();
      res.json({
        tenantId: ctx.tenantId,
        onchainEnabled: req.container.soroban.enabled,
        health: health.ok ? health.value : { status: "unreachable", error: health.error.message },
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
