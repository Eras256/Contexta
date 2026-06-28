import { describe, expect, it } from "vitest";
import { createLogger } from "@contexta/shared";
import { DefindexClient } from "../src/integrations/defindex.js";
import { BlendClient } from "../src/integrations/blend.js";

const logger = createLogger({ service: "integ-test", pretty: false, level: "silent" });

describe("DefindexClient (mock mode)", () => {
  const client = new DefindexClient({ apiUrl: "https://api.defindex.io" }, logger);

  it("runs in mock mode without an API key", () => {
    expect(client.live).toBe(false);
  });

  it("lists, creates, deposits and withdraws", async () => {
    const list = await client.listVaults();
    expect(list.ok).toBe(true);
    if (list.ok) expect(list.value.length).toBeGreaterThan(0);

    const created = await client.createVault({ name: "Test", asset: "USDC", strategy: "usdc_mm" });
    expect(created.ok).toBe(true);

    const dep = await client.deposit("vault_cetes_rwa_001", "10000000000");
    expect(dep.ok).toBe(true);

    const wd = await client.withdraw("vault_cetes_rwa_001", "10000000000");
    expect(wd.ok).toBe(true);
  });

  it("returns an error Result for a missing vault (MissingValue path)", async () => {
    const r = await client.deposit("does_not_exist", "1");
    expect(r.ok).toBe(false);
  });
});

describe("BlendClient (mock mode)", () => {
  const client = new BlendClient({}, logger);

  it("supplies and reflects the position", async () => {
    const supply = await client.supply("USDC", "5000000000");
    expect(supply.ok).toBe(true);
    if (supply.ok) expect(BigInt(supply.value.suppliedBaseUnits)).toBeGreaterThan(0n);
  });

  it("rejects withdrawing more than supplied", async () => {
    const r = await client.withdraw("USDC", "999999999999999");
    expect(r.ok).toBe(false);
  });
});
