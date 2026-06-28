import { Badge, Card, KeyValue, SectionHeader } from "@/components/ui";
import { demoDecisions, demoTenant } from "@/lib/demoData";
import { shortHash } from "@/lib/format";

const ACTION_LABEL: Record<string, string> = {
  deposit_vault: "Deposit to vault",
  withdraw_vault: "Withdraw from vault",
  blend_supply: "Supply to Blend",
  blend_withdraw: "Withdraw from Blend",
  rebalance: "Rebalance",
  fund_payroll: "Fund payroll",
  noop: "Hold (no action)",
};

const CONSENT_RECORDS = [
  { who: "owner@acme.example", what: "treasury-management", at: "2026-01-04 10:02", sig: "G7K2…9f1a" },
  { who: "owner@acme.example", what: "payroll-execution", at: "2026-01-04 10:02", sig: "G7K2…9f1a" },
];

export default function AgentPage() {
  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Agent & Legal Context"
        title="Agent monitoring & Legal Context Protocol"
        description="Configure the legal context that governs agentic commerce, then watch every agent decision link back to its terms, consents, and on-chain settlement."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* LCP editor */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">legal-context.json</h3>
            <Badge tone="agent">v1 · published</Badge>
          </div>
          <KeyValue k="Tenant domain" v={<span className="font-mono text-xs">{demoTenant.domain}</span>} />
          <KeyValue k="Jurisdiction" v="Brazil (BR)" />
          <KeyValue k="Arbitration" v="Contexta default arbitration" />
          <KeyValue k="Consents required" v="treasury-management, payroll-execution" />
          <KeyValue
            k="Document hash"
            v={<span className="font-mono text-xs text-accent">{shortHash(demoTenant.legalContextHash)}</span>}
          />
          <div className="mt-4 flex gap-2">
            <button className="btn-primary">Edit & republish</button>
            <a className="btn-ghost" href="/.well-known/legal-context.json">
              View .well-known
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            In production this document is served from the tenant&apos;s own domain at
            <span className="font-mono"> /.well-known/legal-context.json</span>. Contexta hosts a
            mirror for the demo.
          </p>
        </Card>

        {/* Consent records */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">Consent records</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2">User</th>
                  <th className="pb-2">Consent</th>
                  <th className="pb-2">Accepted</th>
                  <th className="pb-2">Signature</th>
                </tr>
              </thead>
              <tbody>
                {CONSENT_RECORDS.map((c, i) => (
                  <tr key={i} className="table-row">
                    <td className="py-2 text-slate-200">{c.who}</td>
                    <td className="py-2"><Badge>{c.what}</Badge></td>
                    <td className="py-2 font-mono text-xs text-slate-400">{c.at}</td>
                    <td className="py-2 font-mono text-xs text-accent">{c.sig}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Consents are captured before any agentic operation. The API blocks treasury and payroll
            actions (HTTP 412) when a required consent is missing.
          </p>
        </Card>
      </div>

      {/* Agent decisions */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-white">Agent decisions</h3>
        <div className="space-y-3">
          {demoDecisions.map((d) => (
            <div key={d.id} className="rounded-lg border border-white/10 bg-ink-900/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone="agent">{ACTION_LABEL[d.action] ?? d.action}</Badge>
                  <Badge tone={d.status === "executed" ? "success" : d.status === "proposed" ? "warn" : "default"}>
                    {d.status}
                  </Badge>
                </div>
                <span className="font-mono text-xs text-slate-500">{d.createdAt.replace("T", " ").slice(0, 16)}</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">{d.rationale}</p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <span className="text-slate-400">
                  LCP hash:{" "}
                  <span className="font-mono text-accent">{shortHash(d.legalContextHash)}</span>
                </span>
                <span className="text-slate-400">
                  Soroban tx:{" "}
                  <span className="font-mono text-brand">{d.stellarTxHash ?? "—"}</span>
                </span>
                <span className="text-slate-400">
                  Audit:{" "}
                  <span className="font-mono text-slate-300">audit_logs/{d.id}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
