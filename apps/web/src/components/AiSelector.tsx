"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fetchAiStatus, type AiStatus } from "@/lib/api";
import {
  AI_PROVIDERS,
  providerDef,
  getAiConfig,
  setAiConfig,
  clearAiConfig,
  type AiConfig,
} from "@/lib/aiModel";

/**
 * Navbar control + modal to choose which AI powers the agent's reasoning.
 * Lists OpenAI (server default, live) plus bring-your-own-key providers
 * (OpenRouter → Claude/Gemini/Grok/Llama, Groq, DeepSeek, xAI, Together — any
 * AI). The choice is sent on manual agent runs; the 24/7 Fly agent keeps using
 * the server's OpenAI key. The modal renders via a portal so it can never be
 * clipped by the navbar's stacking context.
 */
export function AiSelector() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [cfg, setCfg] = useState<AiConfig | null>(null);

  useEffect(() => {
    setMounted(true);
    let alive = true;
    void fetchAiStatus().then((s) => alive && setStatus(s));
    setCfg(getAiConfig());
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const serverLive = status?.live ?? false;
  const activeProvider = cfg?.provider ?? "openai";
  const activeDef = providerDef(activeProvider);
  // Generic label — this is "connect any AI", not OpenAI-specific. Show the
  // chosen provider's name only when the user has picked one (BYOK).
  const chip = cfg ? (activeDef?.label ?? "AI") : "AI";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Connect AI"
        title="Choose / connect the AI that powers the agent"
      >
        <SparkIcon live={serverLive || Boolean(cfg)} />
        <span className="hidden max-w-[8rem] truncate md:inline">{chip}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" className="opacity-60" aria-hidden>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {mounted &&
        open &&
        createPortal(
          <AiModal
            status={status}
            cfg={cfg}
            onClose={() => setOpen(false)}
            onSaved={(c) => {
              setCfg(c);
              setOpen(false);
            }}
            onReset={() => {
              clearAiConfig();
              setCfg(null);
            }}
          />,
          document.body,
        )}
    </>
  );
}

function AiModal({
  status,
  cfg,
  onClose,
  onSaved,
  onReset,
}: {
  status: AiStatus | null;
  cfg: AiConfig | null;
  onClose: () => void;
  onSaved: (c: AiConfig) => void;
  onReset: () => void;
}) {
  const serverLive = status?.live ?? false;
  const initial = cfg?.provider ?? "openai";
  const [sel, setSel] = useState(initial);
  const [model, setModel] = useState(cfg?.model ?? providerDef(initial)?.models[0] ?? "");
  const [key, setKey] = useState(cfg?.apiKey ?? "");

  const def = providerDef(sel);
  const needsKey = Boolean(def?.byok);
  const canUse = !needsKey || key.trim().length > 0;

  const pick = (id: string) => {
    const d = providerDef(id);
    if (!d) return;
    setSel(id);
    setModel(cfg?.provider === id ? (cfg.model ?? d.models[0]) : d.models[0]);
    setKey(cfg?.provider === id ? (cfg.apiKey ?? "") : "");
  };

  const apply = () => {
    if (!def || !canUse) return;
    const c: AiConfig = {
      provider: sel,
      model: model || def.models[0],
      ...(def.byok ? { apiKey: key.trim() } : {}),
    };
    setAiConfig(c);
    onSaved(c);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-950 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <SparkIcon live />
              Power the agent with any AI
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${serverLive ? "bg-brand shadow-[0_0_6px_#22d3a5]" : "bg-slate-600"}`} />
              {cfg
                ? `Active: ${providerDef(cfg.provider)?.label ?? cfg.provider} · ${cfg.model}`
                : serverLive
                  ? `Deployed agent: ${(status?.provider ?? "openai").toUpperCase()} · ${status?.model} · live`
                  : "Server provider not configured — connect your own below"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AI_PROVIDERS.map((p) => {
            const isSel = p.id === sel;
            return (
              <button
                key={p.id}
                onClick={() => pick(p.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  isSel ? "border-brand/60 bg-brand/10" : "border-white/10 bg-ink-900/60 hover:border-white/25"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium text-white">
                  {p.label}
                  {!p.byok && <span className="rounded bg-brand/15 px-1 py-0.5 text-[9px] font-semibold text-brand">DEFAULT</span>}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{p.note}</span>
              </button>
            );
          })}
        </div>

        {def && (
          <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-ink-900/40 p-4">
            <label className="block text-xs text-slate-400">
              Model
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-ink-900 px-2.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {def.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            {needsKey && (
              <label className="block text-xs text-slate-400">
                <span className="flex items-center justify-between">
                  <span>{def.label} API key</span>
                  {def.keysUrl && (
                    <a href={def.keysUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      get a key ↗
                    </a>
                  )}
                </span>
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={def.keyHint}
                  autoComplete="off"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-ink-900 px-2.5 py-2 font-mono text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </label>
            )}

            <p className="text-[11px] leading-relaxed text-slate-500">
              {needsKey
                ? "Your key is stored only in this browser and used when you run the agent manually."
                : "Used by the deployed 24/7 agent. No key needed — it's configured on the server."}
            </p>
          </div>
        )}

        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4">
          {cfg ? (
            <button onClick={onReset} className="text-xs text-slate-400 hover:text-white">
              Reset to server default
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
              Cancel
            </button>
            <button onClick={apply} disabled={!canUse} className="btn-primary px-4 py-2 text-sm disabled:opacity-40">
              {needsKey ? "Connect & use" : "Use this"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SparkIcon({ live }: { live: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className={live ? "text-brand" : "text-slate-500"}>
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
