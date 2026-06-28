import { describe, it, expect } from "vitest";
import { canonicalize, hashLegalContext, verifyLegalContext } from "./lcp.js";
import type { LegalContext } from "./types.js";

describe("canonicalize", () => {
  it("sorts object keys and drops undefined, preserves array order", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalize({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
    expect(canonicalize({ z: [{ y: 1, x: 2 }] })).toBe('{"z":[{"x":2,"y":1}]}');
  });
});

const doc: LegalContext = {
  specVersion: "0.1.0",
  contextId: "11111111-1111-4111-8111-111111111111",
  version: 1,
  tenantDomain: "acme.contexta.app",
  provider: { legalName: "Acme", jurisdiction: "BR", contactEmail: "legal@acme.example" },
  terms: { url: "https://acme.contexta.app/legal/terms", sha256: "0".repeat(64), effectiveDate: "2026-01-01" },
  jurisdiction: "BR",
  consentRequirements: [
    { id: "treasury-management", description: "x", required: true, scope: ["treasury", "yield"] },
  ],
  disputeChannels: [
    { type: "arbitration", provider: "p", venue: "v", governingLaw: "BR", language: "en" },
  ],
  settlement: { networks: ["stellar:testnet"], assets: ["USDC"] },
  publishedAt: "2026-01-04T10:02:00.000Z",
};

describe("hashLegalContext / verifyLegalContext", () => {
  it("is stable and order-independent", () => {
    const h1 = hashLegalContext(doc);
    const reordered = { ...doc, version: doc.version, contextId: doc.contextId } as LegalContext;
    expect(hashLegalContext(reordered)).toBe(h1);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies a matching hash and rejects a tampered doc", () => {
    const h = hashLegalContext(doc);
    expect(verifyLegalContext(doc, h)).toBe(true);
    expect(verifyLegalContext(doc, h.toUpperCase())).toBe(true);
    expect(verifyLegalContext({ ...doc, version: 2 }, h)).toBe(false);
  });
});
