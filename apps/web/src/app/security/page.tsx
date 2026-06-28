import { Badge, Card, SectionHeader } from "@/components/ui";

const SCANS = [
  { target: "contracts/treasury", tool: "cargo audit + clippy", result: "0 high", at: "2026-06-25", tone: "success" as const },
  { target: "contracts/payroll", tool: "cargo audit + clippy", result: "0 high", at: "2026-06-25", tone: "success" as const },
  { target: "npm dependencies", tool: "pnpm audit", result: "2 low", at: "2026-06-26", tone: "warn" as const },
  { target: "API endpoints", tool: "zod schema + RBAC", result: "passing", at: "2026-06-27", tone: "success" as const },
];

const RBAC = [
  { role: "Owner", caps: "Everything incl. publish legal context, manage tenant" },
  { role: "Admin", caps: "Configure treasury, run payroll, manage integrations" },
  { role: "Member", caps: "Read treasury & payroll, propose (no execute)" },
  { role: "Viewer", caps: "Read-only dashboards" },
];

export default function SecurityPage() {
  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Security & Compliance"
        title="Security, risk & compliance"
        description="How Contexta keeps custody with the company, discloses DeFi risk, and resolves disputes through the Legal Context Protocol."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-white">Non-custodial design</h3>
          <p className="text-sm text-slate-300">
            Treasury keys never leave the company. Agents propose actions; execution is bounded by
            on-chain limits and (in production) multisig / smart-account policies. The platform
            service account can only invoke contract methods the company has authorized.
          </p>
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-white">DeFi & yield risk</h3>
          <p className="text-sm text-slate-300">
            Yield from DeFindex and Blend carries smart-contract, liquidity, and RWA counterparty
            risk. A hard liquidity floor and per-country exposure caps limit how much treasury the
            agent may place at risk at any time.
          </p>
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-white">Dispute resolution (LCP)</h3>
          <p className="text-sm text-slate-300">
            Every agentic transaction references a versioned legal context with named arbitration,
            governing law, and consent requirements — giving counterparties a verifiable basis to
            raise and resolve disputes.
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">Last security scans</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2">Target</th>
                  <th className="pb-2">Tool</th>
                  <th className="pb-2">Result</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {SCANS.map((s, i) => (
                  <tr key={i} className="table-row">
                    <td className="py-2 font-mono text-xs text-slate-300">{s.target}</td>
                    <td className="py-2 text-slate-400">{s.tool}</td>
                    <td className="py-2"><Badge tone={s.tone}>{s.result}</Badge></td>
                    <td className="py-2 font-mono text-xs text-slate-500">{s.at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">Mock results — wired to CI in `.github/workflows/ci.yml`.</p>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">Role-based access control</h3>
          <div className="space-y-2">
            {RBAC.map((r) => (
              <div key={r.role} className="flex items-start gap-3 py-2 table-row">
                <Badge tone="info">{r.role}</Badge>
                <span className="text-sm text-slate-300">{r.caps}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Enforced centrally via the capability matrix in <span className="font-mono">@contexta/config</span>.
          </p>
        </Card>
      </div>
    </div>
  );
}
