import { Badge, Card, SectionHeader } from "@/components/ui";

const BUILDING_BLOCKS = [
  { name: "Stellar / Soroban", use: "Settlement layer; Treasury + Payroll contracts emit LCP-bound events." },
  { name: "Anchors (SEP-24/31)", use: "On/off-ramp digital dollars to PIX, Transferencias 3.0, Bre-B." },
  { name: "DeFindex", use: "RWA / CETES yield vaults; deposit/withdraw via API + strategy metadata." },
  { name: "Blend", use: "Lending pools for USDC supply yield; testnet contracts." },
  { name: "Supabase", use: "Accounts, orgs, payroll, treasury config, audit, legal-context refs." },
  { name: "Fly.io", use: "API + worker hosting in GRU (São Paulo) for LATAM latency." },
];

const SCF_MAP = [
  { exp: "Integrates ≥1 Stellar building block", how: "Soroban contracts + anchors + DeFindex + Blend — four building blocks." },
  { exp: "Clear user & market", how: "LATAM SMBs/startups paying cross-border teams in BR/AR/CO." },
  { exp: "Working testnet demo", how: "End-to-end flow runs on testnet with mock fallbacks for offline judging." },
  { exp: "Production architecture", how: "Monorepo, typed config, RBAC, audit logs, CI, Dockerized deploy." },
  { exp: "Compliance posture", how: "Legal Context Protocol binds terms/consent/dispute to every agent action." },
];

export default function DocsPage() {
  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Docs & SCF"
        title="Documentation & SCF Integration Track"
        description="How Contexta composes Stellar building blocks and maps to Stellar Community Fund Integration Track expectations."
      />

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-white">Stellar building blocks used</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {BUILDING_BLOCKS.map((b) => (
            <div key={b.name} className="rounded-lg border border-white/10 bg-ink-900/60 p-4">
              <Badge tone="success">{b.name}</Badge>
              <p className="mt-2 text-sm text-slate-300">{b.use}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-white">SCF Integration Track mapping</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Expectation</th>
                <th className="pb-2">How Contexta meets it</th>
              </tr>
            </thead>
            <tbody>
              {SCF_MAP.map((r, i) => (
                <tr key={i} className="table-row align-top">
                  <td className="py-3 pr-4 font-medium text-white">{r.exp}</td>
                  <td className="py-3 text-slate-300">{r.how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-white">For judges</h3>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• Architecture overview — see Overview page diagram &amp; root <span className="font-mono">README.md</span></li>
            <li>• API schemas — <span className="font-mono">apps/api/README.md</span> (REST surface)</li>
            <li>• Smart contract interfaces — <span className="font-mono">contracts/*/README.md</span></li>
            <li>• LCP document — <a className="text-accent hover:underline" href="/.well-known/legal-context.json">/.well-known/legal-context.json</a></li>
          </ul>
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-white">Customer discovery (placeholder)</h3>
          <div className="space-y-2 text-sm text-slate-400">
            <p className="italic">Interview summaries to be added manually.</p>
            <ul className="space-y-1">
              <li># Interview 1 — &lt;company, role&gt;</li>
              <li>## Pain — cross-border payroll cost &amp; delays</li>
              <li>## Current workflow — &lt;…&gt;</li>
              <li>## Reaction to Contexta — &lt;…&gt;</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
