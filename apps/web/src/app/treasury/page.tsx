import { AllocationBar, Badge, Card, SectionHeader, Stat } from "@/components/ui";
import { demoPositions, totals } from "@/lib/demoData";
import { bps, shortHash, usdBase } from "@/lib/format";

const STRATEGY_LABEL: Record<string, string> = {
  liquidity: "Liquid reserve",
  defindex_vault: "DeFindex vault",
  blend_pool: "Blend pool",
};

const HISTORY = [
  { ts: "2026-06-26 09:12", actor: "Agent", asset: "USDC", amount: "+20,000", method: "DeFindex · CETES vault", lcp: "b3f1c0a9…2b3c4d" },
  { ts: "2026-06-20 09:12", actor: "Agent", asset: "USDC", amount: "−25,000", method: "DeFindex withdraw", lcp: "b3f1c0a9…2b3c4d" },
  { ts: "2026-06-15 14:40", actor: "Admin", asset: "USDC", amount: "+50,000", method: "Anchor SEP-24 · PIX on-ramp", lcp: "b3f1c0a9…2b3c4d" },
  { ts: "2026-06-10 11:05", actor: "Agent", asset: "USDC", amount: "+15,000", method: "Blend supply", lcp: "b3f1c0a9…2b3c4d" },
];

export default function TreasuryPage() {
  const t = totals(demoPositions);
  const weightedApy =
    demoPositions
      .filter((p) => p.apyBps)
      .reduce((acc, p) => acc + (p.apyBps ?? 0) * Number(BigInt(p.amountBaseUnits)), 0) /
    Math.max(1, Number(BigInt(t.yieldBaseUnits)));

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Treasury"
        title="Treasury dashboard"
        description="Live view of balances across liquidity, DeFindex vaults and Blend pools, with the agent's allocation between liquid reserves and yield."
        action={<Badge tone="success">Autopilot: on</Badge>}
      />

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><Stat label="Total treasury" value={usdBase(t.totalBaseUnits)} sub="USDC-equivalent" /></Card>
        <Card><Stat label="Liquid reserve" value={usdBase(t.liquidBaseUnits)} sub="available for payroll" /></Card>
        <Card><Stat label="In yield" value={usdBase(t.yieldBaseUnits)} sub={`blended APY ${bps(weightedApy)}`} /></Card>
        <Card><Stat label="Yield allocation" value={bps(t.yieldShareBps)} sub="of total treasury" /></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Allocation */}
        <Card className="lg:col-span-1">
          <h3 className="mb-4 text-sm font-semibold text-white">Liquidity vs yield</h3>
          <AllocationBar yieldShareBps={t.yieldShareBps} />
          <p className="mt-4 text-xs text-slate-400">
            Target band is set by your risk profile. The agent keeps a liquidity floor sized to
            upcoming payroll plus an FX-volatility buffer before allocating the rest to yield.
          </p>
        </Card>

        {/* Positions */}
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-white">Positions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2">Asset</th>
                  <th className="pb-2">Strategy</th>
                  <th className="pb-2">Reference</th>
                  <th className="pb-2 text-right">APY</th>
                  <th className="pb-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {demoPositions.map((p, i) => (
                  <tr key={i} className="table-row">
                    <td className="py-2 font-medium text-white">{p.asset}</td>
                    <td className="py-2 text-slate-300">{STRATEGY_LABEL[p.strategy]}</td>
                    <td className="py-2 font-mono text-xs text-slate-400">{p.strategyRef ?? "—"}</td>
                    <td className="py-2 text-right text-slate-300">{p.apyBps ? bps(p.apyBps) : "—"}</td>
                    <td className="py-2 text-right font-medium text-white">{usdBase(p.amountBaseUnits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Configuration */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-white">Risk profile</h3>
          <p className="mb-4 text-xs text-slate-400">Hard constraints the agent must respect.</p>
          <ConfigRow k="Liquidity floor" v="$50,000" />
          <ConfigRow k="Max allocation to yield" v="60%" />
          <ConfigRow k="Country limit · BR" v="50%" />
          <ConfigRow k="Country limit · AR" v="30%" />
          <ConfigRow k="Country limit · CO" v="30%" />
        </Card>
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-white">Agent parameters</h3>
          <p className="mb-4 text-xs text-slate-400">How aggressively the agent reacts.</p>
          <ConfigRow k="Update frequency" v="Every 5 min" />
          <ConfigRow k="Volatility sensitivity" v="60 / 100" />
          <ConfigRow k="Execution mode" v={<Badge tone="warn">Dry-run</Badge>} />
        </Card>
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-white">Anchors &amp; local rails</h3>
          <p className="mb-4 text-xs text-slate-400">On/off-ramp connections (placeholder).</p>
          <ConfigRow k="Brazil" v={<Badge tone="info">PIX · SEP-24</Badge>} />
          <ConfigRow k="Argentina" v={<Badge tone="info">Transferencias 3.0</Badge>} />
          <ConfigRow k="Colombia" v={<Badge tone="info">Bre-B</Badge>} />
          <button className="btn-ghost mt-4 w-full" disabled>
            Connect anchor (demo)
          </button>
        </Card>
      </div>

      {/* History */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Transaction history</h3>
          <div className="flex gap-2">
            <Badge>All</Badge>
            <Badge tone="agent">Agent</Badge>
            <Badge tone="info">Manual</Badge>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">Time</th>
                <th className="pb-2">Actor</th>
                <th className="pb-2">Asset</th>
                <th className="pb-2 text-right">Amount</th>
                <th className="pb-2">Method / strategy</th>
                <th className="pb-2">Legal context</th>
              </tr>
            </thead>
            <tbody>
              {HISTORY.map((h, i) => (
                <tr key={i} className="table-row">
                  <td className="py-2 font-mono text-xs text-slate-400">{h.ts}</td>
                  <td className="py-2">
                    <Badge tone={h.actor === "Agent" ? "agent" : "info"}>{h.actor}</Badge>
                  </td>
                  <td className="py-2 text-slate-200">{h.asset}</td>
                  <td className="py-2 text-right font-medium text-white">{h.amount}</td>
                  <td className="py-2 text-slate-300">{h.method}</td>
                  <td className="py-2 font-mono text-xs text-accent">{shortHash(h.lcp, 8, 6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ConfigRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 table-row">
      <span className="text-sm text-slate-400">{k}</span>
      <span className="text-sm font-medium text-slate-100">{v}</span>
    </div>
  );
}
