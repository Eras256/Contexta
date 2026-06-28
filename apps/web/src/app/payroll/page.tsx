"use client";

import { Badge, Card, DataBadge, SectionHeader, Stat } from "@/components/ui";
import { COUNTRY_LABEL, RAIL_LABEL, fromBaseUnits, usd, usdBase } from "@/lib/format";
import { api, type PayrollEmployee, type TreasurySnapshot } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

const EMPTY_TREASURY: TreasurySnapshot = {
  config: null,
  positions: [],
  totals: { liquidBaseUnits: "0", yieldBaseUnits: "0", totalBaseUnits: "0", yieldShareBps: 0 },
};

export default function PayrollPage() {
  const tr = useT();
  const { accessToken, connect, connecting } = useAuth();
  const employeesQ = useLiveData<PayrollEmployee[]>(api.employees, []);
  const obligationsQ = useLiveData(api.obligations, []);
  const treasuryQ = useLiveData(api.treasury, EMPTY_TREASURY);

  if (!accessToken) {
    return (
      <div className="space-y-8">
        <SectionHeader
          eyebrow={tr("pages.payroll.eyebrow")}
          title={tr("pages.payroll.title")}
          description={tr("pages.payroll.desc")}
        />
        <ConnectGate connect={connect} connecting={connecting} tr={tr} />
      </div>
    );
  }

  const employees = employeesQ.data;
  const active = employees.filter((e) => e.active);
  const monthlyTotal = employees.reduce((acc, e) => acc + Number(e.salaryAmount || 0), 0);
  const next = obligationsQ.data[0];
  const required = next ? fromBaseUnits(next.requiredBaseUnits) : 0;
  const buffer = required * 0.085;
  const needed = required + buffer;
  const ready = fromBaseUnits(treasuryQ.data.totals.liquidBaseUnits);
  const enough = ready >= needed;
  const nextDate = next
    ? new Date(next.nextRunAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "—";

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={tr("pages.payroll.eyebrow")}
        title={tr("pages.payroll.title")}
        description={tr("pages.payroll.desc")}
        action={<DataBadge live={employeesQ.live} loading={employeesQ.loading} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><Stat label={tr("pages.payroll.statPeople")} value={active.length} sub={tr("pages.payroll.statPeopleSub")} /></Card>
        <Card><Stat label={tr("pages.payroll.statMonthly")} value={usd(monthlyTotal)} sub={tr("pages.payroll.statMonthlySub")} /></Card>
        <Card><Stat label={tr("pages.payroll.statNext")} value={nextDate} sub={next?.scheduleName ?? tr("pages.payroll.nextNone")} /></Card>
        <Card><Stat label={tr("pages.payroll.statNeeded")} value={next ? usd(needed) : "—"} sub={tr("pages.payroll.statNeededSub")} /></Card>
      </div>

      {/* Team */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-white">{tr("pages.payroll.teamTitle")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">{tr("pages.payroll.colName")}</th>
                <th className="pb-2">{tr("pages.payroll.colCountry")}</th>
                <th className="pb-2">{tr("pages.payroll.colAsset")}</th>
                <th className="pb-2">{tr("pages.payroll.colRail")}</th>
                <th className="pb-2 text-right">{tr("pages.payroll.colSalary")}</th>
                <th className="pb-2 text-right">{tr("pages.payroll.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="table-row">
                  <td className="py-2 font-medium text-white">{e.fullName}</td>
                  <td className="py-2 text-slate-300">{COUNTRY_LABEL[e.country] ?? e.country}</td>
                  <td className="py-2 text-slate-300">{e.payoutAsset}</td>
                  <td className="py-2 text-slate-300">{RAIL_LABEL[e.preferredRail] ?? e.preferredRail}</td>
                  <td className="py-2 text-right font-medium text-white">{usd(Number(e.salaryAmount || 0))}</td>
                  <td className="py-2 text-right">
                    <Badge tone={e.active ? "success" : "default"}>
                      {e.active ? tr("pages.payroll.active") : tr("pages.payroll.paused")}
                    </Badge>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    {employeesQ.loading ? "…" : tr("pages.payroll.teamEmpty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Funding */}
      <Card className="max-w-xl">
        <h3 className="mb-1 text-sm font-semibold text-white">{tr("pages.payroll.fundTitle")}</h3>
        <p className="mb-4 text-xs text-slate-400">{tr("pages.payroll.fundBody")}</p>
        <div className="space-y-3 text-sm">
          <Row k={tr("pages.payroll.fundGross")} v={next ? usd(required) : "—"} />
          <Row k={tr("pages.payroll.fundBuffer")} v={next ? `+ ${usd(buffer)}` : "—"} tone="warn" />
          <Row k={tr("pages.payroll.fundNeeded")} v={next ? usd(needed) : "—"} />
          <div className="my-2 border-t border-white/10" />
          <Row k={tr("pages.payroll.fundReady")} v={usdBase(treasuryQ.data.totals.liquidBaseUnits)} tone="info" />
          {next && (
            <div
              className={`mt-3 rounded-lg border p-3 text-xs ${
                enough ? "border-brand/20 bg-brand/5 text-slate-300" : "border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
              }`}
            >
              {enough ? `✓ ${tr("pages.payroll.fundOk")}` : `! ${tr("pages.payroll.fundShort")}`}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Row({ k, v, tone = "default" }: { k: string; v: string; tone?: "default" | "warn" | "info" }) {
  const c: Record<string, string> = { default: "text-slate-200", warn: "text-accent-gold", info: "text-sky-300" };
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{k}</span>
      <span className={`font-medium ${c[tone]}`}>{v}</span>
    </div>
  );
}

function ConnectGate({
  connect,
  connecting,
  tr,
}: {
  connect: () => void | Promise<void>;
  connecting: boolean;
  tr: (k: string) => string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand/10 via-ink-900/40 to-accent/10 px-6 py-16 text-center">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative mx-auto max-w-md">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-brand/30 bg-brand/10 text-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 11V7a4 4 0 0 0-8 0v4" /><rect x="5" y="11" width="14" height="9" rx="2" />
          </svg>
        </span>
        <h3 className="mt-5 text-xl font-semibold text-white">{tr("pages.payroll.connectTitle")}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-300">{tr("pages.payroll.connectBody")}</p>
        <button className="btn-primary mt-6 px-5 py-2.5" onClick={() => void connect()} disabled={connecting}>
          {connecting ? tr("auth.connecting") : tr("auth.connect")}
        </button>
      </div>
    </div>
  );
}
