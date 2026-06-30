"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthControls } from "@/components/AuthControls";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AiSelector } from "@/components/AiSelector";
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

const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet").toLowerCase();
const NETWORK_LABEL = NETWORK === "mainnet" ? "Mainnet" : "Testnet";

export function Navbar() {
  const pathname = usePathname();
  const t = useT();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        {/* Brand + network */}
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo-icon.svg" className="h-8 w-8" alt="Contextio" />
            <span className="text-base font-semibold tracking-tight text-white">Contextio</span>
          </Link>
          <span className="hidden items-center gap-1.5 rounded-full border border-brand/25 bg-brand/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_6px_#22d3a5]" aria-hidden />
            {NETWORK_LABEL}
          </span>
        </div>

        {/* Center nav */}
        <nav className="hidden flex-1 items-center justify-center gap-0.5 lg:flex" aria-label="Primary">
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

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <LanguageSelector />
          <AiSelector />
          <AuthControls />
          <Link href="/treasury" className="btn-primary hidden px-4 py-2 text-sm sm:inline-flex">
            {t("nav.workspace")}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
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
