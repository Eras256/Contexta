"use client";

import { Card, SectionHeader } from "@/components/ui";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { apiBaseUrl } from "@/lib/api";
import { useT } from "@/lib/i18n";

const REPO_URL = "https://github.com/Eras256/Contextio";
const NPM_URL = "https://www.npmjs.com/package/contextio-sdk";
const STACK = ["Stellar · Soroban", "Rust", "TypeScript", "Next.js", "Supabase", "Fly.io"];

export default function DocsPage() {
  const t = useT();

  const highlights = [
    t("pages.docs.r1"),
    t("pages.docs.r2"),
    t("pages.docs.r3"),
    t("pages.docs.r4"),
  ];

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow={t("pages.docs.eyebrow")}
        title={t("pages.docs.title")}
        description={t("pages.docs.desc")}
      />

      {/* Big picture */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{t("pages.docs.archTitle")}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{t("pages.docs.archBody")}</p>
        </div>
        <Card className="overflow-x-auto">
          <ArchitectureDiagram />
        </Card>
      </section>

      {/* Highlights */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {highlights.map((h) => (
          <div key={h} className="flex items-start gap-2 rounded-xl border border-white/10 bg-ink-900/60 p-4">
            <span className="mt-0.5 text-brand">✓</span>
            <span className="text-sm text-slate-300">{h}</span>
          </div>
        ))}
      </div>

      {/* LCP + SCF */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <h3 className="text-sm font-semibold text-white">{t("pages.docs.lcpTitle")}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{t("pages.docs.lcpBody")}</p>
          <a
            className="btn-ghost mt-4 self-start"
            href={`${apiBaseUrl}/.well-known/legal-context.json?domain=contextio.xyz`}
            target="_blank"
            rel="noreferrer"
          >
            {t("pages.docs.lcpLink")} ↗
          </a>
        </Card>
        <Card className="flex flex-col">
          <h3 className="text-sm font-semibold text-white">{t("pages.docs.scfTitle")}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{t("pages.docs.scfBody")}</p>
          <a className="btn-ghost mt-4 self-start" href={REPO_URL} target="_blank" rel="noreferrer">
            {t("pages.docs.repoLink")} ↗
          </a>
        </Card>
      </div>

      {/* SDK */}
      <Card className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{t("pages.docs.sdkTitle")}</h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-400">{t("pages.docs.sdkBody")}</p>
        </div>
        <a className="btn-primary shrink-0 px-5 py-2.5 text-sm" href={NPM_URL} target="_blank" rel="noreferrer">
          {t("pages.docs.sdkLink")} ↗
        </a>
      </Card>

      {/* Stack */}
      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{t("pages.docs.stackTitle")}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{t("pages.docs.stackBody")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STACK.map((s) => (
            <span
              key={s}
              className="rounded-full border border-white/10 bg-ink-900/60 px-3 py-1.5 font-mono text-xs text-slate-300"
            >
              {s}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
