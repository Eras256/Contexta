"use client";

import { useEffect, useState } from "react";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { bps } from "@/lib/format";
import { useT } from "@/lib/i18n";

type Status = "live" | "mock" | "ready" | "prod";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

interface LiveVault {
  vaultId: string;
  name: string;
  asset: string;
  strategy: string;
  apyBps: number;
  tvlBaseUnits: string;
  positionBaseUnits: string;
  network: string;
}

interface BlendVault {
  poolId: string;
  asset: string;
  supplyApyBps: number;
  tvlBaseUnits: string;
  positionBaseUnits: string;
  network: string;
}

const xlm = (stroops: string) =>
  `${(Number(stroops) / 1e7).toLocaleString(undefined, { maximumFractionDigits: 4 })}`;

interface AnchorInfo {
  anchor: string;
  withdraw: string[];
  deposit: string[];
  protocols: string[];
  transferServer: string | null;
}

export default function IntegrationsPage() {
  const t = useT();
  const [vault, setVault] = useState<LiveVault | null>(null);
  const [blend, setBlend] = useState<BlendVault | null>(null);
  const [anchor, setAnchor] = useState<AnchorInfo | null>(null);
  const [offramp, setOfframp] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [health, setHealth] = useState<{ api: boolean; supabase: boolean; stellar: boolean; agent: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    // Real infra health: /readyz reports Supabase + Stellar RPC; recent agent
    // activity (a decision in the last ~20 min) proves the 24/7 agent is alive.
    void Promise.all([
      fetch(`${API}/readyz`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/api/v1/public/activity`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([ready, activity]) => {
      if (!alive) return;
      const checks = (ready?.checks ?? {}) as Record<string, { ok?: boolean }>;
      const last = activity?.decisions?.[0]?.createdAt as string | undefined;
      const agentLive = last ? Date.now() - new Date(last).getTime() < 20 * 60_000 : false;
      setHealth({
        api: Boolean(ready),
        supabase: Boolean(checks.supabase?.ok),
        stellar: Boolean(checks.stellar?.ok),
        agent: agentLive,
      });
    });
    const grab = (path: string, set: (v: unknown) => void) =>
      fetch(`${API}/api/v1/public/${path}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (alive && j?.live && j.vault) set(j.vault);
        })
        .catch(() => {});
    void grab("defindex", (v) => setVault(v as LiveVault));
    void grab("blend", (v) => setBlend(v as BlendVault));
    fetch(`${API}/api/v1/public/anchor`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.live) setAnchor(j as AnchorInfo);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const explorer = (id: string, net: string) =>
    `https://stellar.expert/explorer/${net === "mainnet" ? "public" : "testnet"}/contract/${id}`;

  // Real SEP-24 off-ramp: the API does SEP-10 auth + interactive withdraw and
  // returns the anchor's hosted page, which we open in a new tab.
  const startOfframp = async () => {
    setOfframp({ loading: true, error: null });
    try {
      const r = (await fetch(`${API}/api/v1/public/anchor/withdraw?asset=USDC`, { cache: "no-store" }).then((x) =>
        x.json(),
      )) as { ok?: boolean; url?: string; error?: string };
      if (r?.ok && r.url) {
        window.open(r.url, "_blank", "noopener");
        setOfframp({ loading: false, error: null });
      } else {
        setOfframp({ loading: false, error: r?.error ?? "Off-ramp failed" });
      }
    } catch (e) {
      setOfframp({ loading: false, error: e instanceof Error ? e.message : "Network error" });
    }
  };

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow={t("pages.integrations.eyebrow")}
        title={t("pages.integrations.title")}
        description={t("pages.integrations.desc")}
      />

      {/* Where spare cash earns */}
      <section className="space-y-4">
        <Header title={t("pages.integrations.yieldTitle")} body={t("pages.integrations.yieldBody")} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Real DeFindex vault */}
          <Card className="flex flex-col sm:col-span-2 lg:col-span-1">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-white">{t("pages.integrations.defindexName")}</span>
              <Badge tone={vault ? "success" : "warn"}>
                {t(vault ? "pages.integrations.statusLive" : "pages.integrations.statusReady")}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {t("pages.integrations.defindexBody")}
            </p>
            {vault ? (
              <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs">
                <Row k={t("pages.integrations.dfxApy")} v={<span className="font-semibold text-brand">{bps(vault.apyBps)}</span>} />
                <Row k={t("pages.integrations.dfxTvl")} v={<span className="font-mono text-slate-300">{xlm(vault.tvlBaseUnits)} {vault.asset}</span>} />
                <Row k={t("pages.integrations.dfxPosition")} v={<span className="font-mono text-slate-300">{xlm(vault.positionBaseUnits)} {vault.asset}</span>} />
                <Row k="Strategy" v={<span className="text-slate-300">{vault.strategy}</span>} />
                <a
                  className="mt-2 inline-flex font-mono text-accent hover:underline"
                  href={explorer(vault.vaultId, vault.network)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("pages.integrations.dfxView")} ↗
                </a>
              </div>
            ) : (
              <div className="mt-3 border-t border-white/5 pt-3 text-xs text-slate-500">{t("auth.connecting")}</div>
            )}
          </Card>

          {/* Real Blend pool */}
          <Card className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-white">{t("pages.integrations.blendName")}</span>
              <Badge tone={blend ? "success" : "warn"}>
                {t(blend ? "pages.integrations.statusLive" : "pages.integrations.statusReady")}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{t("pages.integrations.blendBody")}</p>
            {blend ? (
              <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs">
                <Row k={t("pages.integrations.dfxApy")} v={<span className="font-semibold text-brand">{bps(blend.supplyApyBps)}</span>} />
                <Row k={t("pages.integrations.dfxTvl")} v={<span className="font-mono text-slate-300">{xlm(blend.tvlBaseUnits)} {blend.asset}</span>} />
                <Row k={t("pages.integrations.dfxPosition")} v={<span className="font-mono text-slate-300">{xlm(blend.positionBaseUnits)} {blend.asset}</span>} />
                <a
                  className="mt-2 inline-flex font-mono text-accent hover:underline"
                  href={explorer(blend.poolId, blend.network)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("pages.integrations.dfxView")} ↗
                </a>
              </div>
            ) : (
              <div className="mt-3 border-t border-white/5 pt-3 text-xs text-slate-500">{t("auth.connecting")}</div>
            )}
          </Card>
        </div>
      </section>

      {/* How your team gets paid */}
      <section className="space-y-4">
        <Header title={t("pages.integrations.railsTitle")} body={t("pages.integrations.railsBody")} />

        {/* Real SEP-24 off-ramp anchor */}
        <Card className="flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-white">{t("pages.integrations.anchorName")}</span>
            <Badge tone={anchor ? "success" : "warn"}>
              {t(anchor ? "pages.integrations.statusLive" : "pages.integrations.statusReady")}
            </Badge>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{t("pages.integrations.anchorBody")}</p>
          {anchor && (
            <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs">
              <Row k="Anchor" v={<span className="font-mono text-slate-300">{anchor.anchor}</span>} />
              <Row k="Off-ramp" v={<span className="font-mono text-slate-300">{anchor.withdraw.join(" · ")}</span>} />
              <Row k="Protocols" v={<span className="font-mono text-slate-300">{anchor.protocols.join(" · ")}</span>} />
            </div>
          )}
          <button
            onClick={() => void startOfframp()}
            disabled={offramp.loading}
            className="btn-primary mt-3 self-start px-4 py-2 text-xs disabled:opacity-40"
          >
            {offramp.loading ? t("auth.connecting") : t("pages.integrations.offrampCta")}
          </button>
          {offramp.error && <p className="mt-2 break-words text-[11px] text-red-400">{offramp.error}</p>}
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <IntegrationCard t={t} name={t("pages.integrations.pixName")} body={t("pages.integrations.pixBody")} status="prod" />
          <IntegrationCard t={t} name={t("pages.integrations.transfersName")} body={t("pages.integrations.transfersBody")} status="prod" />
          <IntegrationCard t={t} name={t("pages.integrations.brebName")} body={t("pages.integrations.brebBody")} status="prod" />
        </div>
      </section>

      {/* Under the hood — these are genuinely live */}
      <section className="space-y-4">
        <Header title={t("pages.integrations.infraTitle")} body={t("pages.integrations.infraBody")} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HealthTile name="Stellar · Soroban" detail="testnet" live={health ? health.stellar : null} t={t} />
          <HealthTile name="Supabase" detail="Postgres · Auth · Realtime" live={health ? health.supabase : null} t={t} />
          <HealthTile name="Fly.io · API" detail="gru · contextio-api" live={health ? health.api : null} t={t} />
          <HealthTile name="Fly.io · Agent" detail="gru · contextio-agent" live={health ? health.agent : null} t={t} />
        </div>
      </section>

      <p className="rounded-2xl border border-white/10 bg-ink-900/40 p-4 text-xs leading-relaxed text-slate-400">
        {t("pages.integrations.note")}
      </p>
    </div>
  );
}

function Header({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-2xl text-sm text-slate-400">{body}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{k}</span>
      {v}
    </div>
  );
}

const STATUS_TONE: Record<Status, "success" | "warn" | "info"> = { live: "success", mock: "warn", ready: "info", prod: "info" };
const STATUS_KEY: Record<Status, string> = {
  live: "pages.integrations.statusLive",
  mock: "pages.integrations.statusMock",
  ready: "pages.integrations.statusReady",
  prod: "pages.integrations.statusProd",
};

function IntegrationCard({
  t,
  name,
  body,
  status,
  metric,
  sub,
}: {
  t: (k: string) => string;
  name: string;
  body: string;
  status: Status;
  metric?: string;
  sub?: string;
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-white">{name}</span>
        <Badge tone={STATUS_TONE[status]}>{t(STATUS_KEY[status])}</Badge>
      </div>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-400">{body}</p>
      {(metric || sub) && (
        <div className="mt-3 flex items-baseline justify-between border-t border-white/5 pt-3">
          {metric && <span className="text-sm font-semibold text-brand">{metric}</span>}
          {sub && <span className="font-mono text-xs text-slate-500">{sub}</span>}
        </div>
      )}
    </Card>
  );
}

function HealthTile({
  name,
  detail,
  live,
  t,
}: {
  name: string;
  detail: string;
  /** true = up, false = down, null = still checking. */
  live: boolean | null;
  t: (k: string) => string;
}) {
  const label =
    live === null ? t("auth.connecting") : live ? t("pages.integrations.statusLive") : t("pages.integrations.statusDown");
  return (
    <div className="rounded-lg border border-white/10 bg-ink-900/60 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-white">{name}</span>
        <span className="relative flex h-2.5 w-2.5">
          {live !== false && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${live ? "bg-brand/70" : "bg-slate-400/50"}`} />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${live === false ? "bg-slate-600" : live === null ? "bg-slate-400" : "bg-brand"}`} />
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
      <p className={`mt-2 text-xs font-medium ${live === false ? "text-slate-500" : "text-brand"}`}>{label}</p>
    </div>
  );
}
