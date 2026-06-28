"use client";

import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

/**
 * Navbar wallet control. Connects any Stellar wallet (Freighter, xBull, Albedo,
 * Lobstr, …) via Stellar Wallets Kit and signs a SEP-53 challenge to sign in.
 */
export function AuthControls() {
  const { loading, connecting, address, role, error, connect, signOut } = useAuth();
  const t = useT();

  if (loading) {
    return <span className="text-xs text-slate-500">…</span>;
  }

  if (address) {
    return (
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 text-xs text-slate-300 sm:flex">
          <span className="h-2 w-2 rounded-full bg-brand" aria-hidden /> {t("auth.live")}
          <span className="ml-1 font-mono text-white">
            {address.slice(0, 4)}…{address.slice(-4)}
          </span>
          {role && <span className="ml-1 text-slate-500">· {role}</span>}
        </span>
        <button className="btn-ghost" onClick={() => void signOut()}>
          {t("auth.disconnect")}
        </button>
      </div>
    );
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
