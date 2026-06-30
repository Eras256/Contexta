"use client";

import { useState } from "react";
import { Card, SectionHeader } from "@/components/ui";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { OnchainProof } from "@/components/OnchainProof";
import { apiBaseUrl } from "@/lib/api";
import { useT } from "@/lib/i18n";

const REPO_URL = "https://github.com/Eras256/Contextio";
const NPM_URL = "https://www.npmjs.com/package/contextio-sdk";
const STACK = ["Stellar · Soroban", "Rust", "TypeScript", "Next.js", "Supabase", "Fly.io"];

type TabId = "architecture" | "api" | "sdk" | "lcp";

export default function DocsPage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<TabId>("architecture");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "architecture", label: "Overview & Architecture" },
    { id: "api", label: "API Reference" },
    { id: "sdk", label: "SDK & Code Samples" },
    { id: "lcp", label: "Legal Context (LCP)" },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      {/* Page Header */}
      <SectionHeader
        eyebrow={t("pages.docs.eyebrow")}
        title={t("pages.docs.title")}
        description={t("pages.docs.desc")}
      />

      {/* Tabs navigation */}
      <div className="flex border-b border-white/10 gap-2 overflow-x-auto pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap pb-3.5 px-4 text-sm font-semibold transition-all border-b-2 ${
              activeTab === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="space-y-8 animate-fade-up">
        {/* Tab 1: Architecture */}
        {activeTab === "architecture" && (
          <div className="space-y-10">
            <section className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{t("pages.docs.archTitle")}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                  {t("pages.docs.archBody")}
                </p>
                <div className="mt-4 p-4 rounded-xl border border-brand/20 bg-brand/5 text-xs text-brand max-w-3xl leading-relaxed">
                  <strong>Non-Custodial Technology Platform Notice:</strong> {"Contextio is a software infrastructure provider, not a fintech, bank, credit institution, or custodian. Operator private keys remain under the user's Freighter or compatible wallet, and any automated agent rebalancing acts as a proposal layer that the tenant explicitly authorizes through cryptographic signatures."}
                </div>
              </div>
              <ArchitectureDiagram />
            </section>

            {/* Verification card */}
            <OnchainProof />

            {/* Oracle & Job Polish */}
            <section className="grid gap-6 md:grid-cols-2">
              <Card className="p-5 space-y-3">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Reflector Oracle Integration (SEP-40)</h4>
                <p className="text-xs leading-relaxed text-slate-400">
                  {"Valuations are driven by the Reflector oracle on-chain. Contextio queries Reflector's smart contract via Soroban ledger simulations to resolve the real-time value of XLM relative to USD. This guarantees that all agentic planning decisions rely on verified, decentralized feeds directly from the network."}
                </p>
              </Card>

              <Card className="p-5 space-y-3">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Staggered Task Scheduling</h4>
                <p className="text-xs leading-relaxed text-slate-400">
                  To prevent sequence number collisions on Stellar nodes, background rebalancing and yield harvesting jobs are stagger-scheduled. The agent scheduler offsets each task (e.g. Blend USDC lending, DeFindex deposits, and treasury evaluations) to stream smoothly over each polling cycle.
                </p>
              </Card>
            </section>

            {/* Stack list */}
            <section className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{t("pages.docs.stackTitle")}</h3>
                <p className="mt-1 text-sm text-slate-400">{t("pages.docs.stackBody")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {STACK.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-white/10 bg-ink-900/60 px-3.5 py-1.5 font-mono text-xs text-slate-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Tab 2: API Reference */}
        {activeTab === "api" && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-white">API Reference</h3>
              <p className="mt-1 text-sm text-slate-400">Core HTTP endpoints served by the Contextio API gateway (hosted at fly.dev or locally on port 8080).</p>
            </div>

            <div className="space-y-6">
              {/* Endpoint block 1 */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 font-mono text-xs font-bold text-brand uppercase">POST</span>
                  <span className="font-mono text-sm text-white">/api/v1/auth/wallet/challenge</span>
                </div>
                <p className="text-xs text-slate-400">Initiates the wallet authentication challenge. Returns an ed25519 payload challenge string designed for Freighter signature to satisfy SEP-53 verification.</p>
              </div>

              {/* Endpoint block 2 */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 font-mono text-xs font-bold text-brand uppercase">POST</span>
                  <span className="font-mono text-sm text-white">/api/v1/auth/wallet/verify</span>
                </div>
                <p className="text-xs text-slate-400">Verifies the signed challenge and issues a HS256 JWT, authorizing company-level read/writes aligned with Postgres Row Level Security.</p>
              </div>

              {/* Endpoint block 3 */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 font-mono text-xs font-bold text-sky-400 uppercase">GET</span>
                  <span className="font-mono text-sm text-white">/api/v1/treasury/positions</span>
                </div>
                <p className="text-xs text-slate-400">Aggregates company balances on-chain. Returns active vaults, APY, holdings, and allocations on Blend and DeFindex. Cached with a 12s TTL to prevent rate limit throttling.</p>
              </div>

              {/* Endpoint block 4 */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 font-mono text-xs font-bold text-brand uppercase">POST</span>
                  <span className="font-mono text-sm text-white">/api/v1/payroll/runs</span>
                </div>
                <p className="text-xs text-slate-400">
                  Executes the scheduled payroll batch payments. Payments are executed directly on-chain.
                  <span className="block mt-1 text-[11px] text-accent font-semibold">Note: Testnet demo operates on a 1:100 scaling ($11,500 gross resolves to 115 USDC transfer) due to testnet asset faucet thresholds.</span>
                </p>
              </div>

              {/* Endpoint block 5 */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 font-mono text-xs font-bold text-sky-400 uppercase">GET</span>
                  <span className="font-mono text-sm text-white">/.well-known/legal-context.json</span>
                </div>
                <p className="text-xs text-slate-400">Serves the public machine-readable Legal Context Protocol (LCP) manifest containing signed terms hash, provider email, allowed scopes, and dispute forums.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: SDK & Code Samples */}
        {activeTab === "sdk" && (
          <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{t("pages.docs.sdkTitle")}</h3>
                <p className="mt-1 text-sm text-slate-400">{t("pages.docs.sdkBody")}</p>
              </div>
              <a className="btn-primary shrink-0 px-5 py-2.5 text-sm" href={NPM_URL} target="_blank" rel="noreferrer">
                {t("pages.docs.sdkLink")} ↗
              </a>
            </div>

            <div className="space-y-6">
              {/* Code block 1 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Initialize SDK Client & Fetch Treasury</span>
                  <button
                    onClick={() => copyToClipboard(
                      `import { ContextioClient } from "contextio-sdk";\n\nconst client = new ContextioClient({\n  apiKey: "your_lcp_tenant_api_key",\n  baseUrl: "https://contextio-api.fly.dev"\n});\n\n// Get aggregate holdings on Blend and DeFindex\nconst positions = await client.getTreasuryPositions();\nconsole.log("Active DeFi Yield Positions:", positions);`,
                      "sdk-init"
                    )}
                    className="text-brand hover:underline font-mono"
                  >
                    {copiedText === "sdk-init" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="rounded-xl border border-white/5 bg-ink-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
                  <pre>{`import { ContextioClient } from "contextio-sdk";

const client = new ContextioClient({
  apiKey: "your_lcp_tenant_api_key",
  baseUrl: "https://contextio-api.fly.dev"
});

// Get aggregate holdings on Blend and DeFindex
const positions = await client.getTreasuryPositions();
console.log("Active DeFi Yield Positions:", positions);`}</pre>
                </div>
              </div>

              {/* Code block 2 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Request Unsigned Rebalance XDR for Self-Custody</span>
                  <button
                    onClick={() => copyToClipboard(
                      `// Request XDR preparation from API\nconst { xdr } = await client.prepareMove({\n  venue: "blend",\n  action: "deposit",\n  asset: "USDC",\n  amount: "500.0000000"\n});\n\n// Sign locally using Freighter\nconst signedXdr = await window.stellarWalletsKit.signTransaction(xdr);\n\n// Submit signed transaction back for settlement\nconst result = await client.submitMove({ signedXdr });\nconsole.log("Onchain Tx Hash:", result.txHash);`,
                      "sdk-rebalance"
                    )}
                    className="text-brand hover:underline font-mono"
                  >
                    {copiedText === "sdk-rebalance" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="rounded-xl border border-white/5 bg-ink-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
                  <pre>{`// Request XDR preparation from API
const { xdr } = await client.prepareMove({
  venue: "blend",
  action: "deposit",
  asset: "USDC",
  amount: "500.0000000"
});

// Sign locally using Freighter
const signedXdr = await window.stellarWalletsKit.signTransaction(xdr);

// Submit signed transaction back for settlement
const result = await client.submitMove({ signedXdr });
console.log("Onchain Tx Hash:", result.txHash);`}</pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Legal Context (LCP) */}
        {activeTab === "lcp" && (
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                {t("pages.docs.lcpTitle")}
              </h3>
              <p className="text-sm leading-relaxed text-slate-300">
                {t("pages.docs.lcpBody")}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  className="btn-primary text-xs px-4 py-2"
                  href="/legal-context"
                >
                  View Live LCP Manifest ➔
                </a>
                <a
                  className="btn-ghost text-xs px-4 py-2"
                  href="/.well-known/legal-context.json"
                  target="_blank"
                  rel="noreferrer"
                >
                  Raw legal-context.json ↗
                </a>
              </div>
            </Card>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Verifying LCP Binding event topic (Soroban SDK verification guide)</span>
                <button
                  onClick={() => copyToClipboard(
                    `import { hashLegalContext, verifyBinding } from "@contextio/shared/lcp";\nimport { fetchLcpManifest } from "@/lib/api";\n\n// 1. Fetch the canonical legal manifest from tenant's domain\nconst manifest = await fetchLcpManifest("contextio.xyz");\n\n// 2. Hash the manifest locally using deterministic canonicalization\nconst manifestHash = hashLegalContext(manifest);\n\n// 3. Verify that the onchain event binding matches the manifest hash\nconst isValid = verifyBinding({\n  onchainBinding: event.topics[2].toString(),\n  manifestHash\n});\n\nconsole.log("LCP Binding status:", isValid ? "VALID & COMPLIANT" : "FAIL");`,
                    "sdk-lcp"
                  )}
                  className="text-brand hover:underline font-mono"
                >
                  {copiedText === "sdk-lcp" ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="rounded-xl border border-white/5 bg-ink-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
                <pre>{`import { hashLegalContext, verifyBinding } from "@contextio/shared/lcp";
import { fetchLcpManifest } from "@/lib/api";

// 1. Fetch the canonical legal manifest from tenant's domain
const manifest = await fetchLcpManifest("contextio.xyz");

// 2. Hash the manifest locally using deterministic canonicalization
const manifestHash = hashLegalContext(manifest);

// 3. Verify that the onchain event binding matches the manifest hash
const isValid = verifyBinding({
  onchainBinding: event.topics[2].toString(),
  manifestHash
});

console.log("LCP Binding status:", isValid ? "VALID & COMPLIANT" : "FAIL");`}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
