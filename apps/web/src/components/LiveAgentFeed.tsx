"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface Activity {
  id: string;
  action: string;
  rationale: string;
  status: string;
  stellarTxHash: string | null;
  createdAt: string;
}
interface Feed {
  agentAddress: string | null;
  network: string;
  decisions: Activity[];
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function LiveAgentFeed() {
  const t = useT();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/v1/public/activity`, { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as Feed;
          if (alive) setFeed(j);
        }
      } catch {
        /* keep last state */
      }
    };
    void load();
    const id = setInterval(() => void load(), 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const addr = feed?.agentAddress ?? null;
  const items = feed?.decisions ?? [];

  return (
    <div className="glass overflow-hidden p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
            </span>
            <span className="label text-brand">{t("feed.eyebrow")}</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">{t("feed.title")}</h2>
          <p className="mt-1 max-w-lg text-sm text-slate-400">{t("feed.subtitle")}</p>
        </div>
        {addr && (
          <div className="rounded-xl border border-white/10 bg-ink-900/60 px-3 py-2">
            <div className="label mb-1 text-[10px]">{t("feed.agentLabel")}</div>
            <div className="flex items-center gap-2">
              <a
                href={`https://stellar.expert/explorer/testnet/account/${addr}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-slate-200 hover:text-brand"
              >
                {addr.slice(0, 6)}…{addr.slice(-6)}
              </a>
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(addr);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
                className="text-slate-500 transition hover:text-white"
                aria-label="Copy agent address"
              >
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5 5L20 7" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2">
        {items.slice(0, 5).map((d) => (
          <div
            key={d.id}
            className="flex items-start gap-3 rounded-xl border border-white/5 bg-ink-900/40 px-3 py-2.5"
          >
            <span
              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                d.status === "executed" ? "bg-brand" : d.status === "proposed" ? "bg-accent-gold" : "bg-slate-500"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-200">{d.rationale}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500">
                <span>{d.status}</span>
                <span>· {timeAgo(d.createdAt)}</span>
                {d.stellarTxHash && !d.stellarTxHash.startsWith("sim:") && (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${d.stellarTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-brand/80 hover:text-brand"
                  >
                    · tx ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">{t("feed.empty")}</p>
        )}
      </div>

      <div className="mt-4">
        <Link href="/agent" className="text-sm font-medium text-brand hover:text-brand-400">
          {t("feed.viewAll")} →
        </Link>
      </div>
    </div>
  );
}
