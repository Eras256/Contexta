"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { api, type ApiAuth, type TreasurySnapshot } from "@/lib/api";

/**
 * Manual treasury controls for the dashboard — everything the autonomous agent
 * does, available by hand: activate/deactivate the agent, move capital between
 * liquidity and a yield venue (real on-chain rebalance), tune the risk rules,
 * and register a yield vault. All of it hits the same audited, LCP-bound API
 * the agent uses.
 */
export function TreasuryControls({
  auth,
  config,
}: {
  auth: ApiAuth;
  config: TreasurySnapshot["config"];
}) {
  const [agentEnabled, setAgentEnabled] = useState(config?.agentEnabled ?? true);
  const [toggling, setToggling] = useState(false);

  const toggleAgent = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      const r = await api.toggleAgent(auth, !agentEnabled);
      setAgentEnabled(r.agentEnabled);
    } catch {
      /* leave previous state */
    } finally {
      setToggling(false);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Manual controls</h3>
          <p className="text-xs text-slate-400">Run the treasury by hand — same audited, on-chain API as the agent.</p>
        </div>
      </div>

      {/* Agent activate / deactivate */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-ink-900/50 p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-white">
            <span className={`inline-block h-2 w-2 rounded-full ${agentEnabled ? "bg-brand shadow-[0_0_8px_#22d3a5]" : "bg-slate-600"}`} />
            Autonomous agent
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {agentEnabled ? "Active — rebalances & lends 24/7 on its own." : "Paused — only manual actions run."}
          </p>
        </div>
        <button
          onClick={() => void toggleAgent()}
          disabled={toggling}
          role="switch"
          aria-checked={agentEnabled}
          aria-label="Toggle autonomous agent"
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${agentEnabled ? "bg-brand" : "bg-slate-700"}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${agentEnabled ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <RebalancePanel auth={auth} />
        <RiskPanel auth={auth} config={config} agentEnabled={agentEnabled} />
      </div>

      <div className="mt-4">
        <CreateVaultPanel auth={auth} />
      </div>
    </Card>
  );
}

const toBase = (usd: string) => {
  const n = Number(usd);
  if (!Number.isFinite(n) || n <= 0) return null;
  return BigInt(Math.round(n * 1e7)).toString();
};

function RebalancePanel({ auth }: { auth: ApiAuth }) {
  const [amount, setAmount] = useState("1");
  const [venue, setVenue] = useState<"blend_pool" | "defindex_vault">("blend_pool");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const asset = venue === "blend_pool" ? "USDC" : "XLM";
  const strategyRef = venue === "blend_pool" ? "blend" : "defindex";

  const move = async (direction: "in" | "out") => {
    const amountBaseUnits = toBase(amount);
    if (!amountBaseUnits || busy) {
      if (!amountBaseUnits) setMsg("Enter a positive amount.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.rebalance(auth, {
        from: direction === "in" ? "liquidity" : venue,
        to: direction === "in" ? venue : "liquidity",
        asset,
        amountBaseUnits,
        strategyRef,
      });
      setMsg(`Settled on-chain · tx ${r.txHash.slice(0, 8)}…`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message.replace(/^API[^:]*:\s*/, "") : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/40 p-4">
      <p className="text-sm font-medium text-white">Move capital</p>
      <p className="mt-0.5 text-xs text-slate-500">Liquidity ⇄ yield venue. Real on-chain rebalance.</p>

      <label className="mt-3 block text-[11px] text-slate-400">
        Venue
        <select
          value={venue}
          onChange={(e) => setVenue(e.target.value as typeof venue)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-ink-900 px-2.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="blend_pool">Blend · USDC lending</option>
          <option value="defindex_vault">DeFindex · XLM vault</option>
        </select>
      </label>

      <label className="mt-2 block text-[11px] text-slate-400">
        Amount ({asset})
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="mt-1 w-full rounded-lg border border-white/15 bg-ink-900 px-2.5 py-2 font-mono text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => void move("in")} disabled={busy} className="btn-primary justify-center px-3 py-2 text-xs disabled:opacity-40">
          {busy ? "…" : "Aportar liquidez"}
        </button>
        <button onClick={() => void move("out")} disabled={busy} className="btn-ghost justify-center px-3 py-2 text-xs disabled:opacity-40">
          {busy ? "…" : "Retirar capital"}
        </button>
      </div>
      {msg && <p className="mt-2 break-words text-[11px] text-slate-400">{msg}</p>}
    </div>
  );
}

function RiskPanel({
  auth,
  config,
  agentEnabled,
}: {
  auth: ApiAuth;
  config: TreasurySnapshot["config"];
  agentEnabled: boolean;
}) {
  const [minLiq, setMinLiq] = useState(config ? (Number(config.minLiquidityBaseUnits) / 1e7).toString() : "0");
  const [maxYieldPct, setMaxYieldPct] = useState(config ? config.maxYieldBps / 100 : 60);
  const [sensitivity, setSensitivity] = useState(config?.volatilitySensitivity ?? 50);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    const base = toBase(minLiq) ?? "0";
    setBusy(true);
    setMsg(null);
    try {
      await api.saveConfig(auth, {
        minLiquidityBaseUnits: base,
        maxYieldBps: Math.round(maxYieldPct * 100),
        volatilitySensitivity: Math.round(sensitivity),
        countryLimitsBps: config?.countryLimitsBps ?? {},
        agentEnabled,
      });
      setMsg("Risk rules saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message.replace(/^API[^:]*:\s*/, "") : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/40 p-4">
      <p className="text-sm font-medium text-white">Risk rules</p>
      <p className="mt-0.5 text-xs text-slate-500">The guardrails the agent must respect.</p>

      <div className="mt-3 space-y-3">
        <div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Max in yield</span>
            <span className="font-mono text-brand">{maxYieldPct.toFixed(0)}%</span>
          </div>
          <input type="range" min={0} max={100} value={maxYieldPct} onChange={(e) => setMaxYieldPct(Number(e.target.value))} className="mt-1 w-full accent-[#22d3a5]" />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>FX sensitivity</span>
            <span className="font-mono text-brand">{sensitivity} / 100</span>
          </div>
          <input type="range" min={0} max={100} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} className="mt-1 w-full accent-[#22d3a5]" />
        </div>
        <label className="block text-[11px] text-slate-400">
          Min liquidity buffer (USDC)
          <input
            value={minLiq}
            onChange={(e) => setMinLiq(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink-900 px-2.5 py-2 font-mono text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </label>
      </div>

      <button onClick={() => void save()} disabled={busy} className="btn-primary mt-3 w-full justify-center px-3 py-2 text-xs disabled:opacity-40">
        {busy ? "Saving…" : "Save risk rules"}
      </button>
      {msg && <p className="mt-2 break-words text-[11px] text-slate-400">{msg}</p>}
    </div>
  );
}

function CreateVaultPanel({ auth }: { auth: ApiAuth }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Corporate Vault");
  const [asset, setAsset] = useState("USDC");
  const [strategy, setStrategy] = useState("blend");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const v = await api.createVault(auth, { name, asset, strategy });
      setMsg(v.vaultId ? `Vault ready · ${v.vaultId.slice(0, 8)}…` : "Vault registered.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message.replace(/^API[^:]*:\s*/, "") : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Vaults</p>
          <p className="mt-0.5 text-xs text-slate-500">Register a yield vault the agent can allocate into.</p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost px-3 py-1.5 text-xs">
          {open ? "Cancel" : "New vault"}
        </button>
      </div>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-lg border border-white/15 bg-ink-900 px-2.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand" />
          <select value={asset} onChange={(e) => setAsset(e.target.value)} className="rounded-lg border border-white/15 bg-ink-900 px-2.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand">
            <option>USDC</option>
            <option>XLM</option>
          </select>
          <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="rounded-lg border border-white/15 bg-ink-900 px-2.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand">
            <option value="blend">Blend</option>
            <option value="defindex">DeFindex</option>
          </select>
          <button onClick={() => void create()} disabled={busy} className="btn-primary justify-center px-3 py-2 text-xs disabled:opacity-40 sm:col-span-3">
            {busy ? "Creating…" : "Create vault"}
          </button>
        </div>
      )}
      {msg && <p className="mt-2 break-words text-[11px] text-slate-400">{msg}</p>}
    </div>
  );
}
