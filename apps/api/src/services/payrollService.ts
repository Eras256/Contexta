import { randomUUID } from "node:crypto";
import { type Logger, toBaseUnits, fromBaseUnits } from "@contexta/shared";
import type {
  PayrollEmployee,
  PayrollRun,
  PayrollRunLine,
  PayrollSchedule,
} from "@contexta/shared";
import type { Repository } from "../db/repository.js";
import type { SorobanGateway } from "../integrations/soroban.js";
import type { LegalContextService } from "./legalContextService.js";
import type { AuditService } from "./auditService.js";

export interface UpcomingObligation {
  scheduleId: string;
  scheduleName: string;
  nextRunAt: string;
  asset: string;
  requiredBaseUnits: string;
  employeeCount: number;
}

/**
 * Payroll domain logic: employees, schedules, obligation forecasting, and
 * legally-bound run execution. Runs settle on-chain via the payroll Soroban
 * contract; fiat off-ramps (PIX / Transferencias 3.0 / Bre-B) are represented
 * per line and would be fulfilled by SEP-24/31 anchors in production.
 */
export class PayrollService {
  constructor(
    private readonly repo: Repository,
    private readonly soroban: SorobanGateway,
    private readonly legal: LegalContextService,
    private readonly audit: AuditService,
    private readonly logger: Logger,
  ) {}

  listEmployees(tenantId: string): Promise<PayrollEmployee[]> {
    return this.repo.listEmployees(tenantId);
  }

  async saveEmployee(
    e: Omit<PayrollEmployee, "id" | "createdAt"> & { id?: string },
    actorId: string | null,
  ): Promise<PayrollEmployee> {
    const saved = await this.repo.upsertEmployee({
      ...e,
      id: e.id ?? randomUUID(),
      createdAt: new Date().toISOString(),
    });
    await this.audit.record({
      tenantId: e.tenantId,
      actorId,
      actorType: "user",
      action: "payroll.employee.created",
      detail: { employeeId: saved.id, country: saved.country },
    });
    return saved;
  }

  deleteEmployee(tenantId: string, id: string): Promise<void> {
    return this.repo.deleteEmployee(tenantId, id);
  }

  listSchedules(tenantId: string): Promise<PayrollSchedule[]> {
    return this.repo.listSchedules(tenantId);
  }

  async saveSchedule(
    s: Omit<PayrollSchedule, "id" | "createdAt"> & { id?: string },
    actorId: string | null,
  ): Promise<PayrollSchedule> {
    const saved = await this.repo.upsertSchedule({
      ...s,
      id: s.id ?? randomUUID(),
      createdAt: new Date().toISOString(),
    });
    await this.audit.record({
      tenantId: s.tenantId,
      actorId,
      actorType: "user",
      action: "payroll.schedule.created",
      detail: { scheduleId: saved.id, cadence: saved.cadence },
    });
    return saved;
  }

  /**
   * Forecast upcoming obligations and the liquidity they require, normalizing
   * every employee's salary into the schedule's settlement asset base units.
   */
  async upcomingObligations(tenantId: string): Promise<UpcomingObligation[]> {
    const [schedules, employees] = await Promise.all([
      this.repo.listSchedules(tenantId),
      this.repo.listEmployees(tenantId),
    ]);
    const byId = new Map(employees.map((e) => [e.id, e]));

    const result: UpcomingObligation[] = [];
    for (const s of schedules.filter((x) => x.active)) {
      let total = 0n;
      let count = 0;
      for (const id of s.employeeIds) {
        const emp = byId.get(id);
        if (!emp || !emp.active) continue;
        total += toBaseUnits(emp.salaryAmount);
        count += 1;
      }
      result.push({
        scheduleId: s.id,
        scheduleName: s.name,
        nextRunAt: s.nextRunAt,
        asset: s.asset,
        requiredBaseUnits: total.toString(),
        employeeCount: count,
      });
    }
    return result.sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt));
  }

  /** Build the per-employee lines for a schedule without executing. */
  async buildRunLines(tenantId: string, schedule: PayrollSchedule): Promise<PayrollRunLine[]> {
    const employees = await this.repo.listEmployees(tenantId);
    const byId = new Map(employees.map((e) => [e.id, e]));
    const lines: PayrollRunLine[] = [];
    for (const id of schedule.employeeIds) {
      const emp = byId.get(id);
      if (!emp || !emp.active) continue;
      lines.push({
        employeeId: emp.id,
        amount: emp.salaryAmount,
        asset: schedule.asset,
        rail: emp.preferredRail,
        destination: emp.walletAddress ?? emp.bankReference ?? "unspecified",
      });
    }
    return lines;
  }

  /**
   * Execute a payroll run. Binds the legal context (payroll-execution consent),
   * settles on-chain via the payroll contract, and records the run + audit log.
   * `dryRun` produces a simulated run for the UI's simulation view.
   */
  async executeRun(input: {
    tenantId: string;
    scheduleId: string;
    actorId: string | null;
    actorType: "user" | "agent";
    dryRun?: boolean;
  }): Promise<PayrollRun> {
    const schedule = await this.repo.getSchedule(input.tenantId, input.scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    const lines = await this.buildRunLines(input.tenantId, schedule);
    const totalBaseUnits = lines.reduce((acc, l) => acc + toBaseUnits(l.amount), 0n);

    const binding = await this.legal.bindForAction(input.tenantId, [
      "treasury-management",
      "payroll-execution",
    ]);

    const run: PayrollRun = {
      id: randomUUID(),
      tenantId: input.tenantId,
      scheduleId: schedule.id,
      status: input.dryRun ? "simulated" : "executing",
      totalAmount: fromBaseUnits(totalBaseUnits),
      asset: schedule.asset,
      lines,
      legalContextId: binding.contextId,
      legalContextHash: binding.hash,
      stellarTxHash: null,
      executedAt: null,
      createdAt: new Date().toISOString(),
    };
    await this.repo.insertPayrollRun(run);

    if (input.dryRun) return run;

    const onchain = await this.soroban.executePayrollRun({
      tenantId: input.tenantId,
      runId: run.id,
      totalBaseUnits: totalBaseUnits.toString(),
      asset: schedule.asset,
      employeeCount: lines.length,
      binding,
    });
    if (!onchain.ok) {
      await this.repo.updatePayrollRun(run.id, { status: "failed" });
      throw onchain.error;
    }

    const executedAt = new Date().toISOString();
    await this.repo.updatePayrollRun(run.id, {
      status: "completed",
      stellarTxHash: onchain.value.txHash,
      executedAt,
    });
    await this.audit.record({
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: "payroll.run.executed",
      detail: { runId: run.id, total: run.totalAmount, txHash: onchain.value.txHash },
      legalContextId: binding.contextId,
    });

    this.logger.info(
      { tenantId: input.tenantId, runId: run.id, txHash: onchain.value.txHash },
      "Payroll run executed",
    );
    return { ...run, status: "completed", stellarTxHash: onchain.value.txHash, executedAt };
  }

  listRuns(tenantId: string): Promise<PayrollRun[]> {
    return this.repo.listRuns(tenantId);
  }
}
