import { Router } from "express";
import { requireCapability } from "../middleware/rbac.js";
import { requireCtx, HttpError } from "../context.js";
import { employeeSchema, runSchema, scheduleSchema } from "../schemas.js";

export function payrollRouter(): Router {
  const router = Router();

  // ── Employees ──────────────────────────────────────────────────────────
  router.get("/employees", requireCapability("payroll.read"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      res.json(await req.container.payroll.listEmployees(ctx.tenantId));
    } catch (e) {
      next(e);
    }
  });

  router.post("/employees", requireCapability("payroll.manage"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const body = employeeSchema.parse(req.body);
      const saved = await req.container.payroll.saveEmployee(
        {
          tenantId: ctx.tenantId,
          fullName: body.fullName,
          email: body.email ?? null,
          country: body.country,
          walletAddress: body.walletAddress ?? null,
          bankReference: body.bankReference ?? null,
          payoutAsset: body.payoutAsset,
          preferredRail: body.preferredRail,
          salaryAmount: body.salaryAmount,
          active: body.active,
          id: body.id,
        },
        ctx.userId,
      );
      res.status(body.id ? 200 : 201).json(saved);
    } catch (e) {
      next(e);
    }
  });

  router.delete("/employees/:id", requireCapability("payroll.manage"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const id = req.params.id;
      if (!id) throw new HttpError(400, "employee id required");
      await req.container.payroll.deleteEmployee(ctx.tenantId, id);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ── Schedules ──────────────────────────────────────────────────────────
  router.get("/schedules", requireCapability("payroll.read"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      res.json(await req.container.payroll.listSchedules(ctx.tenantId));
    } catch (e) {
      next(e);
    }
  });

  router.post("/schedules", requireCapability("payroll.manage"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const body = scheduleSchema.parse(req.body);
      const saved = await req.container.payroll.saveSchedule(
        { tenantId: ctx.tenantId, ...body },
        ctx.userId,
      );
      res.status(body.id ? 200 : 201).json(saved);
    } catch (e) {
      next(e);
    }
  });

  // ── Obligations + runs ─────────────────────────────────────────────────
  router.get("/obligations", requireCapability("payroll.read"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      res.json(await req.container.payroll.upcomingObligations(ctx.tenantId));
    } catch (e) {
      next(e);
    }
  });

  router.get("/runs", requireCapability("payroll.read"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      res.json(await req.container.payroll.listRuns(ctx.tenantId));
    } catch (e) {
      next(e);
    }
  });

  router.post("/runs", requireCapability("payroll.execute"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const body = runSchema.parse(req.body);
      try {
        const run = await req.container.payroll.executeRun({
          tenantId: ctx.tenantId,
          scheduleId: body.scheduleId,
          actorId: ctx.userId,
          actorType: ctx.isAgent ? "agent" : "user",
          dryRun: body.dryRun,
        });
        res.status(201).json(run);
      } catch (opErr) {
        // Surface the real settlement reason (insufficient funds, trustline, …)
        // instead of a generic 500.
        const msg = opErr instanceof Error ? opErr.message : String(opErr);
        res.status(msg === "Schedule not found" ? 404 : 400).json({ error: msg });
      }
    } catch (e) {
      next(e);
    }
  });

  return router;
}
