import type { Logger } from "@contexta/shared";
import type { ApiClient } from "../apiClient.js";

/**
 * Lightweight liveness probe of the Stellar/Soroban integration per tenant.
 * In a fuller build this job would also snapshot FX/yield curves into Supabase
 * for historical charts; here it confirms network reachability each tick.
 */
export async function runRefreshMarketData(
  api: ApiClient,
  tenantIds: string[],
  logger: Logger,
): Promise<void> {
  const sample = tenantIds[0];
  if (!sample) return;
  try {
    const status = await api.stellarStatus(sample);
    logger.debug({ status }, "Stellar status refreshed");
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : String(e) }, "Market data refresh failed");
  }
}
