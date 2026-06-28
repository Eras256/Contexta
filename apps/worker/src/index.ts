import { createServiceClient, createLogger } from "@contexta/shared";
import { env } from "./env.js";
import { ApiClient } from "./apiClient.js";
import { Scheduler } from "./scheduler.js";
import { runAgentRebalance } from "./jobs/agentRebalance.js";
import { runScheduledPayroll } from "./jobs/scheduledPayroll.js";
import { runRefreshMarketData } from "./jobs/refreshMarketData.js";

/**
 * Worker entrypoint. Loads active tenants from Supabase, then schedules the
 * agent rebalance, scheduled-payroll, and market-data jobs. All agentic effects
 * route through the API (internal-secret auth) so policy is enforced in one place.
 */
async function main(): Promise<void> {
  const config = env();
  const logger = createLogger({ service: "worker", level: config.LOG_LEVEL });
  const supabase = createServiceClient({
    url: config.SUPABASE_URL,
    serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
  });
  const api = new ApiClient(config.API_BASE_URL, config.INTERNAL_API_SECRET, logger);

  async function activeTenantIds(): Promise<string[]> {
    const { data, error } = await supabase.from("tenants").select("id");
    if (error) {
      logger.error({ err: error.message }, "Failed to list tenants");
      return [];
    }
    return (data ?? []).map((r) => r.id as string);
  }

  const intervalMs = config.AGENT_POLL_INTERVAL_SECONDS * 1000;
  const scheduler = new Scheduler(logger);

  logger.info(
    { intervalMs, dryRun: config.AGENT_DRY_RUN, api: config.API_BASE_URL },
    "Worker starting",
  );

  scheduler.add({
    name: "agent-rebalance",
    intervalMs,
    run: async () => runAgentRebalance(api, await activeTenantIds(), config.AGENT_DRY_RUN, logger),
  });

  scheduler.add({
    name: "scheduled-payroll",
    intervalMs,
    run: async () => runScheduledPayroll(api, await activeTenantIds(), config.AGENT_DRY_RUN, logger),
  });

  scheduler.add({
    name: "refresh-market-data",
    intervalMs: Math.max(60_000, Math.floor(intervalMs / 2)),
    run: async () => runRefreshMarketData(api, await activeTenantIds(), logger),
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Worker shutting down");
    scheduler.stop();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((e) => {
  console.error("Worker fatal error:", e);
  process.exit(1);
});
