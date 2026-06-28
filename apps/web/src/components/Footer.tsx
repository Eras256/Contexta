"use client";

import { useT } from "@/lib/i18n";

export function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-white/10 bg-ink-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>{t("footer.tagline")}</p>
        <div className="flex flex-wrap gap-4">
          <a className="hover:text-slate-300" href="/.well-known/legal-context.json">
            legal-context.json
          </a>
          <a className="hover:text-slate-300" href="/security">
            {t("footer.security")}
          </a>
          <a className="hover:text-slate-300" href="/docs">
            {t("footer.docs")}
          </a>
        </div>
      </div>
    </footer>
  );
}
