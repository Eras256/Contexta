"use client";

import { useEffect, useState } from "react";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { bps } from "@/lib/format";
import { useT } from "@/lib/i18n";

type Status = "live" | "mock" | "ready";

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

export default function IntegrationsPage() {
  const t = useT();
  const [vault, setVault] = useState<LiveVault | null>(null);
  const [blend, setBlend] = useState<BlendVault | null>(null);

  useEffect(() => {
    let alive = true;
    const grab = (path: string, set: (v: unknown) => void) =>
      fetch(`${API}/api/v1/public/${path}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (alive && j?.live && j.vault) set(j.vault);
        })
        .catch(() => {});
    void grab("defindex", (v) => setVault(v as LiveVault));
    void grab("blend", (v) => setBlend(v as BlendVault));
    return () => {
      alive = false;
    };
  }, []);

  const explorer = (id: string, net: string) =>
    `https://stellar.expert/explorer/${net === "mainnet" ? "public" : "testnet"}/contract/${id}`;

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
        <div className="grid gap-4 sm:grid-cols-3">
          <IntegrationCard t={t} name={t("pages.integrations.pixName")} body={t("pages.integrations.pixBody")} status="mock" />
          <IntegrationCard t={t} name={t("pages.integrations.transfersName")} body={t("pages.integrations.transfersBody")} status="mock" />
          <IntegrationCard t={t} name={t("pages.integrations.brebName")} body={t("pages.integrations.brebBody")} status="mock" />
        </div>
      </section>

      {/* Under the hood — these are genuinely live */}
      <section className="space-y-4">
        <Header title={t("pages.integrations.infraTitle")} body={t("pages.integrations.infraBody")} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HealthTile name="Stellar · Soroban" detail="testnet" status="live" t={t} />
          <HealthTile name="Supabase" detail="Postgres · Auth · Realtime" status="live" t={t} />
          <HealthTile name="Fly.io · API" detail="gru · contextio-api" status="live" t={t} />
          <HealthTile name="Fly.io · Agent" detail="gru · contextio-agent" status="live" t={t} />
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

const STATUS_TONE: Record<Status, "success" | "warn" | "info"> = { live: "success", mock: "warn", ready: "info" };
const STATUS_KEY: Record<Status, string> = {
  live: "pages.integrations.statusLive",
  mock: "pages.integrations.statusMock",
  ready: "pages.integrations.statusReady",
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
  status,
  t,
}: {
  name: string;
  detail: string;
  status: Status;
  t: (k: string) => string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-ink-900/60 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-white">{name}</span>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
      <p className="mt-2 text-xs font-medium text-brand">{t(STATUS_KEY[status])}</p>
    </div>
  );
}
