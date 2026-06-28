import { createLogger } from "@contextio/shared";
import type { Container } from "../src/container.js";

/**
 * Builds a Container whose dependencies are in-memory fakes. Lets us exercise
 * the HTTP layer (routing, auth, validation, error mapping) without Supabase,
 * Stellar, DeFindex or Blend. Override any field per test.
 */
export function makeTestContainer(overrides: Partial<Container> = {}): Container {
  const logger = createLogger({ service: "api-test", pretty: false, level: "silent" });

  const base = {
    logger,
    supabase: {} as never,
    repo: {
      getTenantByDomain: async () => null,
      getTenant: async () => ({
        id: "t1",
        name: "Test",
        domain: "test.contexta.app",
        country: "BR",
        legalContextId: null,
        createdAt: "",
        updatedAt: "",
      }),
      getMembership: async (_t: string, _u: string) => ({
        tenantId: "t1",
        userId: "u1",
        role: "owner" as const,
        createdAt: "",
      }),
    },
    defindex: { live: false, listVaults: async () => ({ ok: true, value: [] }) },
    blend: { live: false },
    soroban: {
      enabled: false,
      health: async () => ({ ok: true, value: { status: "healthy", latestLedger: 1 } }),
    },
    oracle: {},
    audit: { list: async () => [] },
    legal: {},
    treasury: {
      snapshot: async () => ({
        config: null,
        positions: [],
        totals: {
          liquidBaseUnits: "0",
          yieldBaseUnits: "0",
          totalBaseUnits: "0",
          yieldShareBps: 0,
        },
      }),
    },
    payroll: {},
    agent: { listDecisions: async () => [] },
  } as unknown as Container;

  return { ...base, ...overrides };
}
