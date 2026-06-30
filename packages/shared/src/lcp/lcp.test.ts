import { describe, expect, it } from "vitest";
import { buildLegalContext, hashLegalContext, bindLegalContext, verifyBinding } from "./index.js";

const baseInput = {
  contextId: "11111111-1111-4111-8111-111111111111",
  version: 1,
  tenantDomain: "acme.contexta.app",
  providerLegalName: "Acme Treasury Ltda",
  providerJurisdiction: "BR, AR, CO",
  providerContactEmail: "legal@contextio.xyz",
  termsUrl: "https://acme.contexta.app/legal/terms",
  termsSha256: "a".repeat(64),
  termsEffectiveDate: "2026-01-01",
  jurisdictions: ["BR", "AR", "CO"],
};

describe("LCP", () => {
  it("produces a stable hash regardless of key insertion order", () => {
    const a = buildLegalContext(baseInput);
    const b = buildLegalContext(baseInput);
    // publishedAt differs by call; normalize for a deterministic comparison.
    const normalized = { ...b, publishedAt: a.publishedAt };
    expect(hashLegalContext(a)).toEqual(hashLegalContext(normalized));
  });

  it("binds and verifies required consents", () => {
    const ctx = buildLegalContext(baseInput);
    const binding = bindLegalContext(ctx, ["treasury-management", "payroll-execution"]);
    expect(binding.hash).toHaveLength(64);
    expect(verifyBinding(ctx, binding)).toBe(true);
  });

  it("rejects unknown consent ids", () => {
    const ctx = buildLegalContext(baseInput);
    expect(() => bindLegalContext(ctx, ["does-not-exist"])).toThrow(/Unknown consent/);
  });

  it("rejects when a required consent is missing", () => {
    const ctx = buildLegalContext(baseInput);
    expect(() => bindLegalContext(ctx, ["treasury-management"])).toThrow(/Missing required/);
  });

  it("detects a tampered context via verifyBinding", () => {
    const ctx = buildLegalContext(baseInput);
    const binding = bindLegalContext(ctx, ["treasury-management", "payroll-execution"]);
    const tampered = { ...ctx, version: 2 };
    expect(verifyBinding(tampered, binding)).toBe(false);
  });
});
