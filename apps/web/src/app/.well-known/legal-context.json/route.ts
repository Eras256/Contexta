import { NextResponse } from "next/server";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

/**
 * Canonical LCP document for this tenant domain. The Legal Context Protocol
 * hashes the document served here, so it MUST be the real, published document
 * (with the real terms hash) — we proxy it from the API rather than serving a
 * static placeholder, guaranteeing it matches what's bound on-chain.
 */
export async function GET(request: Request) {
  const acceptHeader = request.headers.get("accept") ?? "";
  if (acceptHeader.includes("text/html")) {
    const url = new URL(request.url);
    url.pathname = "/legal-context";
    return NextResponse.redirect(url);
  }

  try {
    const r = await fetch(`${API}/.well-known/legal-context.json?domain=contextio.xyz`, {
      cache: "no-store",
    });
    if (r.ok) {
      const doc = await r.json();
      return NextResponse.json(doc, {
        headers: {
          "Cache-Control": "public, max-age=300",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  } catch {
    /* fall through to 503 — never serve a fake/placeholder canonical document */
  }
  return NextResponse.json(
    { error: "legal_context_unavailable" },
    { status: 503, headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
