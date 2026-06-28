import { describe, expect, it } from "vitest";
import { loadServerEnv } from "./env.js";

const VALID: NodeJS.ProcessEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  SUPABASE_JWT_SECRET: "jwt-secret",
  STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
  STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
  STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  INTERNAL_API_SECRET: "a-sufficiently-long-secret",
};

describe("loadServerEnv", () => {
  it("parses a valid environment with defaults", () => {
    const env = loadServerEnv(VALID);
    expect(env.API_PORT).toBe(8080);
    expect(env.STELLAR_NETWORK).toBe("testnet");
    expect(env.FX_PROVIDER).toBe("mock");
  });

  it("rejects a short internal secret", () => {
    expect(() => loadServerEnv({ ...VALID, INTERNAL_API_SECRET: "short" })).toThrow(
      /INTERNAL_API_SECRET/,
    );
  });

  it("rejects a missing supabase url", () => {
    const { SUPABASE_URL: _omit, ...rest } = VALID;
    expect(() => loadServerEnv(rest)).toThrow(/SUPABASE_URL/);
  });
});
