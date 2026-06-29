"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { api, type ApiAuth, type TreasurySnapshot } from "@/lib/api";
import { signWalletMessage, signWalletTransaction } from "@/lib/wallet";

/**
 * Manual treasury controls for the dashboard — everything the autonomous agent
 * does, available by hand: activate/deactivate the agent, move capital between
 * liquidity and a yield venue (real on-chain rebalance), tune the risk rules,
 * and register a yield vault. All of it hits the same audited, LCP-bound API
 * the agent uses.
 */
export function TreasuryControls({
  auth,
  address,
  config,
}: {
  auth: ApiAuth;
  address: string | null;
  config: TreasurySnapshot["config"];
}) {
  const [agentEnabled, setAgentEnabled] = useState(config?.agentEnabled ?? true);
  const [toggling, setToggling] = useState(false);
  const [toggleMsg, setToggleMsg] = useState<string | null>(null);

  const toggleAgent = async () => {
    if (toggling) return;
    if (!address) return setToggleMsg("Connect a wallet first.");
    setToggling(true);
    setToggleMsg(null);
    try {
      const next = !agentEnabled;
      // SEP-53 consent: you sign the authorization with your own wallet.
      const message = [
        "Contextio — Agent authorization",
        `Action: ${next ? "enable" : "disable"}`,
        `Address: ${address}`,
        `Issued: ${new Date().toISOString()}`,
        "This authorizes Contextio's agent to manage your treasury within your risk rules. It does not move funds.",
      ].join("\n");
      setToggleMsg("Approve in your wallet…");
      const signedMessage = await signWalletMessage(message, address);
      const r = await api.toggleAgent(auth, next, { address, message, signedMessage });
      setAgentEnabled(r.agentEnabled);
      setToggleMsg(r.agentEnabled ? "Agent activated — signed by you." : "Agent paused — signed by you.");
    } catch (e) {
      setToggleMsg(friendlyError(e instanceof Error ? e.message : String(e)));
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
          {toggleMsg && <p className="mt-1 text-[11px] text-slate-400">{toggleMsg}</p>}
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
        <RebalancePanel auth={auth} address={address} />
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

const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet").toLowerCase();
const txUrl = (hash: string) =>
  `https://stellar.expert/explorer/${NETWORK === "mainnet" ? "public" : "testnet"}/tx/${hash}`;

function TxLink({ hash }: { hash: string }) {
  return (
    <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="font-mono text-brand hover:underline">
      tx {hash.slice(0, 8)}…{hash.slice(-6)} ↗
    </a>
  );
}

/** Turn raw on-chain / API error strings into one readable line. */
function friendlyError(m: string): string {
  const s = m.toLowerCase();
  if (/declin|reject|cancel/.test(s)) return "Signature cancelled in your wallet.";
  if (/txbadseq|bad.?seq/.test(s)) return "Network busy — a previous tx is still settling. Wait a few seconds and retry.";
  if (/insufficientbalance|insufficient balance/.test(s)) return "Amount exceeds your position here. Try a smaller amount (e.g. withdraw a bit less than you supplied).";
  if (/trustline/.test(s)) return "Your wallet needs a trustline for this asset first.";
  if (/underfunded|txinsufficient/.test(s)) return "Your wallet doesn't have enough balance for this amount plus fees.";
  return m.length > 180 ? `${m.slice(0, 180)}…` : m;
}

function RebalancePanel({ auth, address }: { auth: ApiAuth; address: string | null }) {
  const [amount, setAmount] = useState("1");
  const [venue, setVenue] = useState<"blend" | "defindex">("blend");
  const [asset, setAsset] = useState<"XLM" | "USDC">("XLM");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);

  const selectCls =
    "mt-1 w-full rounded-lg border border-white/15 bg-ink-900 px-2.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand";
  const effectiveAsset: "XLM" | "USDC" = venue === "defindex" ? "XLM" : asset;

  const move = async (direction: "in" | "out") => {
    const amountBaseUnits = toBase(amount);
    if (!amountBaseUnits) return setMsg("Enter a positive amount.");
    if (!address) return setMsg("Connect a wallet first.");
    if (busy) return;
    setBusy(true);
    setMsg(null);
    setTx(null);

    // One self-custody attempt: build → user signs in Freighter → submit.
    const attempt = async (): Promise<string> => {
      const { xdr } = await api.prepareMove(auth, {
        venue,
        direction: direction === "in" ? "supply" : "withdraw",
        asset: effectiveAsset,
        amountBaseUnits,
        address,
      });
      setMsg("Approve in your wallet…");
      const signed = await signWalletTransaction(xdr, address);
      setMsg("Submitting…");
      const r = await api.submitMove(auth, signed);
      return r.txHash;
    };

    try {
      setMsg("Preparing transaction…");
      let txHash: string;
      try {
        txHash = await attempt();
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        // Sequence race with a still-settling tx → re-prepare with a fresh seq (one retry).
        if (/txbadseq|bad.?seq/i.test(m)) {
          setMsg("A previous tx is still settling — retrying with a fresh sequence…");
          txHash = await attempt();
        } else {
          throw e;
        }
      }
      setTx(txHash);
      setMsg("Signed by you — settled on-chain:");
    } catch (e) {
      setMsg(friendlyError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/40 p-4">
      <p className="text-sm font-medium text-white">Move capital</p>
      <p className="mt-0.5 text-xs text-slate-500">You sign with your own wallet — self-custody.</p>

      <label className="mt-3 block text-[11px] text-slate-400">
        Venue
        <select value={venue} onChange={(e) => setVenue(e.target.value as typeof venue)} className={selectCls}>
          <option value="blend">Blend · lending</option>
          <option value="defindex">DeFindex · XLM vault</option>
        </select>
      </label>

      {venue === "blend" && (
        <label className="mt-2 block text-[11px] text-slate-400">
          Asset
          <select value={asset} onChange={(e) => setAsset(e.target.value as typeof asset)} className={selectCls}>
            <option value="XLM">XLM — works with your testnet balance</option>
            <option value="USDC">USDC — needs trustline + balance</option>
          </select>
        </label>
      )}

      <label className="mt-2 block text-[11px] text-slate-400">
        Amount ({effectiveAsset})
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
      {(msg || tx) && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 break-words text-[11px] text-slate-400">
          <span>{msg}</span>
          {tx && <TxLink hash={tx} />}
        </p>
      )}
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
