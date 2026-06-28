import { Badge, Card, SectionHeader, Stat } from "@/components/ui";
import { demoEmployees, demoSchedule } from "@/lib/demoData";
import { COUNTRY_LABEL, RAIL_LABEL, usd, usdBase } from "@/lib/format";

export default function PayrollPage() {
  const monthlyTotal = demoEmployees.reduce((acc, e) => acc + Number(e.salaryAmount), 0);
  const requiredLiquidity = Number(BigInt(demoSchedule.requiredBaseUnits)) / 1e7;
  const volBuffer = requiredLiquidity * 0.085;

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Payroll"
        title="Payroll & contractors"
        description="Manage your LATAM team, schedule recurring or one-off payouts, and see exactly how the agent will fund each run."
        action={<button className="btn-primary">Add employee</button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><Stat label="Active people" value={demoEmployees.length} sub="BR · AR · CO" /></Card>
        <Card><Stat label="Monthly obligations" value={usd(monthlyTotal)} sub="gross" /></Card>
        <Card><Stat label="Next run" value="Jul 1" sub="Monthly LATAM payroll" /></Card>
        <Card><Stat label="Required liquidity" value={usd(requiredLiquidity + volBuffer)} sub="incl. FX buffer" /></Card>
      </div>

      {/* Employees */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-white">Employees &amp; contractors</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Name</th>
                <th className="pb-2">Country</th>
                <th className="pb-2">Payout asset</th>
                <th className="pb-2">Rail</th>
                <th className="pb-2 text-right">Salary</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {demoEmployees.map((e) => (
                <tr key={e.id} className="table-row">
                  <td className="py-2 font-medium text-white">{e.fullName}</td>
                  <td className="py-2 text-slate-300">{COUNTRY_LABEL[e.country]}</td>
                  <td className="py-2 text-slate-300">{e.payoutAsset}</td>
                  <td className="py-2 text-slate-300">{RAIL_LABEL[e.preferredRail]}</td>
                  <td className="py-2 text-right font-medium text-white">{usd(Number(e.salaryAmount))}</td>
                  <td className="py-2 text-right">
                    <Badge tone={e.active ? "success" : "default"}>{e.active ? "Active" : "Paused"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Schedule editor */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">Schedule editor</h3>
          <div className="space-y-3">
            <Field label="Schedule name" value={demoSchedule.name} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cadence" value="Monthly" />
              <Field label="Next run" value="2026-07-01" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Settlement asset" value="USDC" />
              <Field label="Default rail" value="Stellar → anchors" />
            </div>
            <div className="flex gap-2 pt-2">
              <button className="btn-primary">Save schedule</button>
              <button className="btn-ghost">Add one-off payout</button>
            </div>
          </div>
        </Card>

        {/* Simulation */}
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-white">Funding simulation</h3>
          <p className="mb-4 text-xs text-slate-400">
            How the agent plans to meet the next run, sourced from yield where there&apos;s a surplus.
          </p>
          <div className="space-y-3 text-sm">
            <SimRow k="Gross obligations" v={usdBase(demoSchedule.requiredBaseUnits)} tone="default" />
            <SimRow k="FX volatility buffer (8.5%)" v={`+ ${usd(volBuffer)}`} tone="warn" />
            <SimRow k="Currently liquid" v={usd(95000)} tone="info" />
            <div className="my-2 border-t border-white/10" />
            <SimRow k="Action: withdraw from CETES vault" v={`− ${usd(0)}`} tone="success" />
            <SimRow k="Liquidity after plan" v={usd(95000)} tone="success" />
            <div className="mt-4 rounded-lg border border-brand/20 bg-brand/5 p-3 text-xs text-slate-300">
              ✓ Liquidity sufficient — agent holds yield positions. A legal-context binding
              (payroll-execution consent) will be attached at run time.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        defaultValue={value}
        className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white focus:border-brand/50 focus:outline-none"
      />
    </label>
  );
}

function SimRow({ k, v, tone }: { k: string; v: string; tone: "default" | "warn" | "info" | "success" }) {
  const colors: Record<string, string> = {
    default: "text-slate-200",
    warn: "text-accent-gold",
    info: "text-sky-300",
    success: "text-brand",
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{k}</span>
      <span className={`font-medium ${colors[tone]}`}>{v}</span>
    </div>
  );
}
