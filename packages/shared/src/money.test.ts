import { describe, expect, it } from "vitest";
import { applyBps, fromBaseUnits, toBaseUnits } from "./money.js";

describe("money", () => {
  it("round-trips decimal <-> base units", () => {
    expect(toBaseUnits("1")).toBe(10_000_000n);
    expect(toBaseUnits("0.0000001")).toBe(1n);
    expect(fromBaseUnits(10_000_000n)).toBe("1");
    expect(fromBaseUnits(12_345_000n)).toBe("1.2345");
  });

  it("handles negatives", () => {
    expect(toBaseUnits("-2.5")).toBe(-25_000_000n);
    expect(fromBaseUnits(-25_000_000n)).toBe("-2.5");
  });

  it("rejects malformed input", () => {
    expect(() => toBaseUnits("1.2.3")).toThrow();
    expect(() => toBaseUnits("abc")).toThrow();
  });

  it("applies basis points", () => {
    expect(applyBps(10_000_000n, 2500)).toBe(2_500_000n);
  });
});
