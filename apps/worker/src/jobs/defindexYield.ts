import type { Logger } from "@contextio/shared";
import type { ApiClient } from "../apiClient.js";

/**
 * For each active tenant, drive one real DeFindex yield cycle through the API
 * (deposit/withdraw a fixed step into the platform's live vault). The API does
 * the signing, LCP binding, and decision recording; the worker only paces it on
 * a slow cadence so the autonomous agent visibly moves idle cash into real,
 * on-chain yield without burning fees every tick. Skipped in dry-run.
 */
export async function runDefindexYield(
  api: ApiClient,
  tenantIds: string[],
  logger: Logger,
): Promise<void> {
  for (const tenantId of tenantIds) {
    try {
      const r = (await api.yieldCycle(tenantId)) as { id?: string; skipped?: boolean };
      if (r?.skipped) {
        logger.debug({ tenantId }, "DeFindex yield cycle skipped (not live)");
      } else {
        logger.info({ tenantId, decisionId: r?.id }, "DeFindex yield cycle settled");
      }
    } catch (e) {
      logger.warn({ tenantId, err: e instanceof Error ? e.message : String(e) }, "DeFindex yield cycle failed");
    }
  }
}
