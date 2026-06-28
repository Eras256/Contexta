import type { Logger } from "@contextio/shared";
import type { ApiClient } from "../apiClient.js";

/**
 * For each active tenant, drive one real Blend lending cycle through the API
 * (supply/withdraw a fixed XLM step into the live Blend pool). The API builds
 * the Blend `submit` op, signs it, submits via Soroban RPC, and records the
 * decision. The worker only paces it. Skipped in dry-run.
 */
export async function runBlendYield(
  api: ApiClient,
  tenantIds: string[],
  logger: Logger,
): Promise<void> {
  for (const tenantId of tenantIds) {
    try {
      const r = (await api.blendCycle(tenantId)) as { id?: string; skipped?: boolean };
      if (r?.skipped) {
        logger.debug({ tenantId }, "Blend lending cycle skipped (not live)");
      } else {
        logger.info({ tenantId, decisionId: r?.id }, "Blend lending cycle settled");
      }
    } catch (e) {
      logger.warn({ tenantId, err: e instanceof Error ? e.message : String(e) }, "Blend lending cycle failed");
    }
  }
}
