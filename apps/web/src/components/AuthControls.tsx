"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

/**
 * Navbar wallet control. Connects any Stellar wallet (Freighter, xBull, Albedo,
 * Lobstr, …) via Stellar Wallets Kit and signs a SEP-53 challenge to sign in.
 */
export function AuthControls() {
  const { loading, connecting, address, error, connect, signOut } = useAuth();
  const t = useT();

  if (loading) {
    return (
      <button className="btn-ghost" disabled>
        {t("auth.connect")}
      </button>
    );
  }

  if (address) {
    return <ConnectedChip address={address} signOut={signOut} t={t} />;
  }

  return (
    <div className="flex flex-col items-end">
      <button className="btn-ghost" onClick={() => void connect()} disabled={connecting}>
        {connecting ? t("auth.connecting") : t("auth.connect")}
      </button>
      {error && <span className="mt-1 max-w-[16rem] text-right text-xs text-red-400">{error}</span>}
    </div>
  );
}

function ConnectedChip({
  address,
  signOut,
  t,
}: {
  address: string;
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
    <span className="flex items-center rounded-full border border-white/15 bg-white/5 py-1 pl-2.5 pr-1">
      <span className="mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand shadow-[0_0_6px_#22d3a5]" aria-hidden />
      <button
        onClick={() => void copy()}
        title={copied ? "Copied" : "Copy address"}
        aria-label={copied ? "Address copied" : "Copy wallet address"}
        className="flex items-center gap-1.5 rounded-full px-1 py-0.5 font-mono text-xs text-white transition hover:bg-white/10"
      >
        {address.slice(0, 4)}…{address.slice(-4)}
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <button
        onClick={() => void signOut()}
        title={t("auth.disconnect")}
        aria-label={t("auth.disconnect")}
        className="ml-0.5 rounded-full p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
      >
        <LogoutIcon />
      </button>
    </span>
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

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
