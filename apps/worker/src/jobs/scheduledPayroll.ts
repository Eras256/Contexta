import type { Logger } from "@contexta/shared";
import type { ApiClient } from "../apiClient.js";

/**
 * Detects payroll schedules whose next run is due and triggers execution via
 * the API. The API enforces the LCP payroll-execution consent before settling,
 * so a due-but-unconsented schedule is logged and skipped rather than forced.
 */
export async function runScheduledPayroll(
  api: ApiClient,
  tenantIds: string[],
  dryRun: boolean,
  logger: Logger,
): Promise<void> {
  const now = Date.now();
  for (const tenantId of tenantIds) {
    try {
      const obligations = await api.obligations(tenantId);
      const due = obligations.filter((o) => new Date(o.nextRunAt).getTime() <= now);
      for (const o of due) {
        const run = await api.executeRun(tenantId, o.scheduleId, dryRun);
        logger.info({ tenantId, scheduleId: o.scheduleId, runId: run.id, dryRun }, "Payroll run triggered");
      }
    } catch (e) {
      logger.warn(
        { tenantId, err: e instanceof Error ? e.message : String(e) },
        "Scheduled payroll check failed",
      );
    }
  }
}
