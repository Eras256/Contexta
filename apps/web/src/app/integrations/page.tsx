import { Badge, Card, KeyValue, SectionHeader, Stat } from "@/components/ui";
import { demoVaults } from "@/lib/demoData";
import { bps, usdBase } from "@/lib/format";

export default function IntegrationsPage() {
  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Integrations"
        title="DeFi, Stellar & infrastructure"
        description="Connect treasury strategies to DeFindex vaults and Blend pools, monitor Stellar network health, and check platform infrastructure."
      />

      {/* DeFindex */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">DeFindex vaults</h3>
            <p className="text-xs text-slate-400">Map treasury strategies to vault IDs (CETES / RWA, money-market).</p>
          </div>
          <Badge tone="warn">Mock mode</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {demoVaults.map((v) => (
            <div key={v.vaultId} className="rounded-lg border border-white/10 bg-ink-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{v.name}</span>
                <Badge tone="success">{bps(v.apyBps)} APY</Badge>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-400">Vault ID</span><span className="font-mono text-slate-300">{v.vaultId}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Asset</span><span className="text-slate-300">{v.asset}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">TVL</span><span className="text-slate-300">{usdBase(v.tvlBaseUnits)}</span></div>
              </div>
              <button className="btn-ghost mt-3 w-full text-xs">Link to strategy</button>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Blend */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Blend positions</h3>
            <Badge tone="warn">Testnet</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Supplied (USDC)" value={usdBase("300000000000")} sub="5.40% supply APY" />
            <Stat label="Borrowed" value="$0" sub="no open borrow" />
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary text-xs">Open supply position</button>
            <button className="btn-ghost text-xs">Close position</button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Wired to the published Blend testnet pool contracts; falls back to a deterministic mock
            when contract IDs aren&apos;t configured.
          </p>
        </Card>

        {/* Stellar */}
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-white">Stellar network</h3>
          <KeyValue k="Network" v={<Badge tone="info">Testnet</Badge>} />
          <KeyValue k="Soroban RPC" v={<Badge tone="success">healthy</Badge>} />
          <KeyValue k="Treasury contract" v={<span className="font-mono text-xs">C…not&nbsp;deployed</span>} />
          <KeyValue k="Payroll contract" v={<span className="font-mono text-xs">C…not&nbsp;deployed</span>} />
          <KeyValue k="On-chain execution" v={<Badge tone="warn">Simulation</Badge>} />
          <p className="mt-3 text-xs text-slate-500">
            Deploy contracts with the Stellar CLI, then set TREASURY_CONTRACT_ID / PAYROLL_CONTRACT_ID
            to switch from simulation to live settlement.
          </p>
        </Card>
      </div>

      {/* Supabase & Fly.io */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-white">Platform health</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <HealthTile name="Supabase" detail="Postgres + Auth" status="connected" />
          <HealthTile name="Fly.io · API" detail="gru · contexta-api" status="connected" />
          <HealthTile name="Fly.io · Worker" detail="gru · contexta-worker" status="connected" />
        </div>
      </Card>
    </div>
  );
}

function HealthTile({ name, detail, status }: { name: string; detail: string; status: "connected" | "down" }) {
  return (
    <div className="rounded-lg border border-white/10 bg-ink-900/60 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-white">{name}</span>
        <span className={`h-2.5 w-2.5 rounded-full ${status === "connected" ? "bg-brand" : "bg-red-500"}`} />
      </div>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
      <p className="mt-2 text-xs font-medium text-brand">{status === "connected" ? "Connected" : "Unreachable"}</p>
    </div>
  );
}
