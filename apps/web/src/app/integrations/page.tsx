"use client";

import { Badge, Card, SectionHeader } from "@/components/ui";
import { demoVaults } from "@/lib/demoData";
import { bps, usdBase } from "@/lib/format";
import { useT } from "@/lib/i18n";

type Status = "live" | "mock" | "ready";

export default function IntegrationsPage() {
  const t = useT();

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
          {demoVaults.map((v) => (
            <IntegrationCard
              key={v.vaultId}
              t={t}
              name={`${t("pages.integrations.defindexName")} · ${v.name}`}
              body={t("pages.integrations.defindexBody")}
              status="mock"
              metric={`${bps(v.apyBps)} APY`}
              sub={`${v.asset} · ${usdBase(v.tvlBaseUnits)} TVL`}
            />
          ))}
          <IntegrationCard
            t={t}
            name={t("pages.integrations.blendName")}
            body={t("pages.integrations.blendBody")}
            status="mock"
            metric="5.40% APY"
            sub="USDC"
          />
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

const STATUS_TONE: Record<Status, "success" | "warn" | "info"> = {
  live: "success",
  mock: "warn",
  ready: "info",
};
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
