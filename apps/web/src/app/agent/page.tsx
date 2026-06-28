"use client";

import { Badge, Card, KeyValue, SectionHeader } from "@/components/ui";
import { shortHash, localDateTime } from "@/lib/format";
import { api, apiBaseUrl, type Decision, type LegalState } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

const ACTION_LABEL: Record<string, string> = {
  deposit_vault: "Deposit to savings",
  withdraw_vault: "Withdraw from savings",
  blend_supply: "Supply to lending",
  blend_withdraw: "Withdraw from lending",
  rebalance: "Rebalance",
  fund_payroll: "Fund payroll",
  noop: "Hold (no action)",
};

interface LegalDoc {
  tenantDomain?: string;
  jurisdiction?: string;
  consentRequirements?: { id: string; description: string }[];
  disputeChannels?: { governingLaw: string }[];
}

const COUNTRY_FLAG: Record<string, string> = { BR: "🇧🇷 Brazil", AR: "🇦🇷 Argentina", CO: "🇨🇴 Colombia" };

export default function AgentPage() {
  const t = useT();
  const { accessToken, connect, connecting } = useAuth();
  const decisions = useLiveData<Decision[]>(api.decisions, [], { realtimeTable: "agent_decisions" });
  const legal = useLiveData<LegalState>(api.legal, { published: false });

  if (!accessToken) {
    return (
      <div className="space-y-8">
        <SectionHeader
          eyebrow={t("pages.agent.eyebrow")}
          title={t("pages.agent.title")}
          description={t("pages.agent.desc")}
        />
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand/10 via-ink-900/40 to-accent/10 px-6 py-16 text-center">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
          <div className="relative mx-auto max-w-md">
            <h3 className="text-xl font-semibold text-white">{t("pages.agent.title")}</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-300">{t("pages.agent.desc")}</p>
            <button className="btn-primary mt-6 px-5 py-2.5" onClick={() => void connect()} disabled={connecting}>
              {connecting ? t("auth.connecting") : t("auth.connect")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const doc = (legal.data.document ?? {}) as LegalDoc;
  const consents = doc.consentRequirements ?? [];
  const countries = Array.from(new Set((doc.disputeChannels ?? []).map((c) => c.governingLaw)));

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={t("pages.agent.eyebrow")}
        title={t("pages.agent.title")}
        description={t("pages.agent.desc")}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Legal context */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">legal-context.json</h3>
            <Badge tone={legal.data.published ? "agent" : "default"}>
              {legal.data.published ? "published" : "—"}
            </Badge>
          </div>
          <KeyValue k="Domain" v={<span className="font-mono text-xs">{doc.tenantDomain ?? "—"}</span>} />
          <KeyValue
            k="Active in"
            v={
              countries.length
                ? countries.map((c) => COUNTRY_FLAG[c] ?? c).join(" · ")
                : (doc.jurisdiction ?? "—")
            }
          />
          <KeyValue
            k="Document hash"
            v={
              legal.data.hash ? (
                <a
                  className="font-mono text-xs text-accent hover:underline hover:text-accent/80 transition inline-flex items-center gap-1"
                  href={`${apiBaseUrl}/.well-known/legal-context.json?domain=${doc.tenantDomain ?? "acme.contexta.app"}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortHash(legal.data.hash)} ↗
                </a>
              ) : (
                <span className="font-mono text-xs text-slate-500">—</span>
              )
            }
          />
          {legal.data.published && doc.tenantDomain && (
            <div className="mt-4">
              <a
                className="btn-ghost"
                href={`${apiBaseUrl}/.well-known/legal-context.json?domain=${doc.tenantDomain}`}
                target="_blank"
                rel="noreferrer"
              >
                View .well-known
              </a>
            </div>
          )}
        </Card>

        {/* Real consent requirements from the published context */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">Required consents</h3>
          <div className="space-y-2">
            {consents.map((c) => (
              <div key={c.id} className="rounded-lg border border-white/10 bg-ink-900/60 p-3">
                <Badge>{c.id}</Badge>
                <p className="mt-2 text-xs text-slate-400">{c.description}</p>
              </div>
            ))}
            {consents.length === 0 && (
              <p className="text-sm text-slate-500">No legal context published yet.</p>
            )}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            The assistant cannot run treasury or payroll without these consents — the API returns
            HTTP 412 if one is missing.
          </p>
        </Card>
      </div>

      {/* Agent decisions (real) */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-white">{t("pages.treasury.activityTitle")}</h3>
        <div className="space-y-3">
          {decisions.data.map((d) => (
            <div key={d.id} className="rounded-lg border border-white/10 bg-ink-900/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone="agent">{ACTION_LABEL[d.action] ?? d.action}</Badge>
                  <Badge tone={d.status === "executed" ? "success" : d.status === "proposed" ? "warn" : "default"}>
                    {d.status}
                  </Badge>
                </div>
                <span className="font-mono text-xs text-slate-500">{localDateTime(d.createdAt)}</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">{d.rationale}</p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <span className="text-slate-400">
                  LCP:{" "}
                  {d.legalContextHash ? (
                    <a
                      className="font-mono text-accent hover:underline hover:text-accent/80 transition inline-flex items-center gap-1"
                      href={`${apiBaseUrl}/.well-known/legal-context.json?domain=${doc.tenantDomain ?? "acme.contexta.app"}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortHash(d.legalContextHash)} ↗
                    </a>
                  ) : (
                    <span className="font-mono text-slate-500">—</span>
                  )}
                </span>
                <span className="text-slate-400">
                  tx:{" "}
                  {d.stellarTxHash && !d.stellarTxHash.startsWith("sim:") ? (
                    <a
                      className="font-mono text-brand hover:underline"
                      href={`https://stellar.expert/explorer/testnet/tx/${d.stellarTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortHash(d.stellarTxHash, 10, 6)} ↗
                    </a>
                  ) : (
                    <span className="font-mono text-slate-500">{d.stellarTxHash ?? "—"}</span>
                  )}
                </span>
              </div>
            </div>
          ))}
          {decisions.data.length === 0 && (
            <p className="text-sm text-slate-500">{t("pages.treasury.activityEmpty")}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
