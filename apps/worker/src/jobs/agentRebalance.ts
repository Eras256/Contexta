import type { Logger } from "@contextio/shared";
import type { ApiClient } from "../apiClient.js";

/**
 * For each active tenant, ask the agent to evaluate the treasury and (unless in
 * dry-run) execute the proposed rebalance. The heavy lifting — planning, legal
 * binding, on-chain settlement — lives in the API's AgentService; the worker
 * only drives the cadence.
 */
export async function runAgentRebalance(
  api: ApiClient,
  tenantIds: string[],
  dryRun: boolean,
  logger: Logger,
): Promise<void> {
  for (const tenantId of tenantIds) {
    try {
      const decision = await api.proposeRebalance(tenantId, !dryRun);
      logger.info(
        { tenantId, decisionId: decision.id, action: decision.action, dryRun },
        "Agent rebalance tick",
      );
    } catch (e) {
      // A single tenant's failure (e.g. missing legal context → 412) must not
      // halt the loop for everyone else.
      logger.warn({ tenantId, err: e instanceof Error ? e.message : String(e) }, "Rebalance failed");
    }
  }
}
