import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const acceptHeader = request.headers.get("accept") ?? "";
  
  if (acceptHeader.includes("text/html")) {
    const url = new URL(request.url);
    url.pathname = "/legal-context";
    return NextResponse.redirect(url);
  }
  
  const doc = {
    specVersion: "0.1.0",
    contextId: "11111111-1111-4111-8111-111111111111",
    version: 1,
    tenantDomain: "contextio.xyz",
    provider: {
      legalName: "Acme Treasury Ltda",
      jurisdiction: "BR",
      contactEmail: "legal@acme.example",
    },
    terms: {
      url: "https://contextio.xyz/legal/terms",
      sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      effectiveDate: "2026-01-01",
    },
    jurisdictions: ["BR", "AR", "CO"],
    consentRequirements: [
      {
        id: "treasury-management",
        description: "Authorize agents to allocate idle treasury.",
        required: true,
        scope: ["treasury", "yield"],
      },
      {
        id: "payroll-execution",
        description: "Authorize scheduled payroll settlement.",
        required: true,
        scope: ["payroll", "offramp"],
      },
    ],
    disputeChannels: [
      {
        type: "arbitration",
        provider: "Contextio default arbitration",
        venue: "https://contextio.xyz/legal/disputes",
        governingLaw: "BR",
        language: "en",
      },
    ],
    settlement: {
      networks: ["stellar:testnet", "stellar:pubnet"],
      assets: ["USDC", "XLM"],
    },
    publishedAt: "2026-01-04T10:02:00.000Z",
  };

  return NextResponse.json(doc, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
