"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthControls } from "@/components/AuthControls";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useT } from "@/lib/i18n";

const SECTIONS = [
  { href: "/", key: "nav.home" },
  { href: "/treasury", key: "nav.treasury" },
  { href: "/payroll", key: "nav.payroll" },
  { href: "/agent", key: "nav.agent" },
  { href: "/integrations", key: "nav.integrations" },
  { href: "/security", key: "nav.security" },
  { href: "/docs", key: "nav.docs" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const t = useT();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 text-sm font-bold text-ink-950">
            Cx
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">
            Contexta
            <span className="ml-2 hidden text-xs font-normal text-slate-400 sm:inline">
              Smart Treasury · Stellar
            </span>
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Primary">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`nav-link ${isActive(s.href) ? "nav-link-active" : ""}`}
            >
              {t(s.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/treasury" className="btn-ghost hidden sm:inline-flex">
            {t("nav.workspace")}
          </Link>
          <LanguageSelector />
          <AuthControls />
        </div>
      </div>

      {/* Mobile section scroller */}
      <div className="flex gap-1 overflow-x-auto border-t border-white/5 px-4 py-2 lg:hidden">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`nav-link whitespace-nowrap ${isActive(s.href) ? "nav-link-active" : ""}`}
          >
            {t(s.key)}
          </Link>
        ))}
      </div>
    </header>
  );
}
