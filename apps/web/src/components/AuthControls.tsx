"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet").toLowerCase();
const NETWORK_LABEL = NETWORK === "mainnet" ? "Mainnet" : "Testnet";

/**
 * Navbar wallet control. Connects any Stellar wallet (Freighter, xBull, Albedo,
 * Lobstr, …) via Stellar Wallets Kit and signs a SEP-53 challenge to sign in.
 */
export function AuthControls() {
  const { loading, connecting, address, role, error, connect, signOut } = useAuth();
  const t = useT();

  if (loading) {
    // Show the connect button immediately (disabled) instead of a bare ellipsis,
    // so the wallet CTA is always visible while the session restores.
    return (
      <button className="btn-primary" disabled>
        {t("auth.connect")}
      </button>
    );
  }

  if (address) {
    return <ConnectedChip address={address} role={role} signOut={signOut} t={t} />;
  }

  return (
    <div className="flex flex-col items-end">
      <button className="btn-primary" onClick={() => void connect()} disabled={connecting}>
        {connecting ? t("auth.connecting") : t("auth.connect")}
      </button>
      {error && <span className="mt-1 max-w-[16rem] text-right text-xs text-red-400">{error}</span>}
    </div>
  );
}

function ConnectedChip({
  address,
  role,
  signOut,
  t,
}: {
  address: string;
  role: string | null;
  signOut: () => void | Promise<void>;
  t: (k: string) => string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center rounded-full border border-brand/25 bg-brand/[0.06] py-1 pl-2.5 pr-1 sm:flex">
        <span className="mr-1 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
          </span>
          {NETWORK_LABEL}
        </span>
        <button
          onClick={() => void copy()}
          title={copied ? "Copied" : "Copy address"}
          aria-label={copied ? "Address copied" : "Copy wallet address"}
          className="flex items-center gap-1.5 rounded-full px-1.5 py-0.5 font-mono text-xs text-white transition hover:bg-white/10"
        >
          {address.slice(0, 4)}…{address.slice(-4)}
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
        {role && <span className="ml-0.5 pr-1.5 text-[10px] capitalize text-slate-500">{role}</span>}
      </span>
      <button className="btn-ghost" onClick={() => void signOut()}>
        {t("auth.disconnect")}
      </button>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
