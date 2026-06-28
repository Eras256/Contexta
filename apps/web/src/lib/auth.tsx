"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, type WalletSession } from "./api";
import { connectWallet, disconnectWallet, signWalletMessage } from "./wallet";
import { supabase } from "./supabase";

const STORAGE_KEY = "contexta.session";

interface AuthState {
  loading: boolean;
  connecting: boolean;
  session: WalletSession | null;
  accessToken: string | null;
  tenantId: string | null;
  address: string | null;
  role: string | null;
  error: string | null;
  connect: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function isExpired(session: WalletSession): boolean {
  return Date.parse(session.expiresAt) < Date.now();
}

/** Point Supabase Realtime/RLS at the wallet-minted session JWT (or anon). */
function applyRealtimeAuth(token: string | null) {
  if (!supabase) return;
  supabase.realtime.setAuth(token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [session, setSession] = useState<WalletSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore a persisted session on load.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as WalletSession;
        if (!isExpired(s)) {
          setSession(s);
          applyRealtimeAuth(s.token);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      /* ignore malformed storage */
    }
    setLoading(false);
  }, []);

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const address = await connectWallet();
      const { message, hmac } = await authApi.challenge(address);
      const signedMessage = await signWalletMessage(message, address);
      const s = await authApi.verify({ address, message, hmac, signedMessage });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      setSession(s);
      applyRealtimeAuth(s.token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }

  async function signOut() {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    applyRealtimeAuth(null);
    await disconnectWallet();
  }

  const value: AuthState = {
    loading,
    connecting,
    session,
    accessToken: session?.token ?? null,
    tenantId: session?.tenantId ?? null,
    address: session?.address ?? null,
    role: session?.role ?? null,
    error,
    connect,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
