import type { ReactNode } from "react";

/** Small, dependency-free UI primitives shared across feature pages. */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Emphasize as the primary KPI (larger value). */
  accent?: boolean;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`mt-1 font-semibold tracking-tight text-white ${accent ? "text-3xl" : "stat-value"}`}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warn" | "info" | "agent";
}) {
  const tones: Record<string, string> = {
    default: "border-white/10 bg-white/5 text-slate-300",
    success: "border-brand/30 bg-brand/10 text-brand",
    warn: "border-accent-gold/30 bg-accent-gold/10 text-accent-gold",
    info: "border-sky-400/30 bg-sky-400/10 text-sky-300",
    agent: "border-accent/30 bg-accent/10 text-accent",
  };
  return <span className={`pill ${tones[tone]}`}>{children}</span>;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <div className="label mb-1 text-brand">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-slate-400">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function AllocationBar({ yieldShareBps }: { yieldShareBps: number }) {
  const yieldPct = Math.min(100, Math.max(0, yieldShareBps / 100));
  const liquidPct = 100 - yieldPct;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full border border-white/10">
        <div className="bg-sky-400/80" style={{ width: `${liquidPct}%` }} aria-label="Liquidity" />
        <div className="bg-brand/80" style={{ width: `${yieldPct}%` }} aria-label="Yield" />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        <span>Liquidity {liquidPct.toFixed(1)}%</span>
        <span>Yield {yieldPct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function DataBadge({ live, loading }: { live: boolean; loading: boolean }) {
  if (loading) return <Badge>Loading…</Badge>;
  return live ? (
    <Badge tone="success">● Live data</Badge>
  ) : (
    <Badge tone="warn">Demo data · sign in</Badge>
  );
}

export function KeyValue({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 table-row">
      <span className="text-sm text-slate-400">{k}</span>
      <span className="text-sm font-medium text-slate-100">{v}</span>
    </div>
  );
}
