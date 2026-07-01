"use client";

/**
 * The LLM the user chooses to power the agent's reasoning. Persisted client-side
 * and sent on manual agent runs (`POST /agent/propose`). The 24/7 Fly worker
 * ignores this and uses the server-configured provider (OpenAI).
 *
 * Every provider here speaks the OpenAI-compatible Chat Completions format, so
 * one client targets all of them. OpenRouter routes to Claude / Gemini / Grok /
 * Llama through a single key — so this genuinely connects "any AI".
 */
export interface ProviderDef {
  id: string;
  label: string;
  models: string[];
  keyHint: string;
  /** true → the user must bring their own key; false → uses the server default. */
  byok: boolean;
  note: string;
  keysUrl?: string;
}

export const AI_PROVIDERS: ProviderDef[] = [
  {
    id: "openai",
    label: "OpenAI",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    keyHint: "sk-...",
    byok: false,
    note: "Powers the deployed agent",
  },
  {
    id: "anthropic",
    label: "Anthropic · Claude",
    models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"],
    keyHint: "sk-ant-...",
    byok: true,
    note: "Claude — native Anthropic",
    keysUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    models: [
      "anthropic/claude-3.7-sonnet",
      "google/gemini-2.0-flash-001",
      "x-ai/grok-2-1212",
      "meta-llama/llama-3.3-70b-instruct",
    ],
    keyHint: "sk-or-...",
    byok: true,
    note: "Any model — Claude, Gemini, Grok, Llama…",
    keysUrl: "https://openrouter.ai/keys",
  },
  {
    id: "groq",
    label: "Groq",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    keyHint: "gsk_...",
    byok: true,
    note: "Ultra-fast inference",
    keysUrl: "https://console.groq.com/keys",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    models: ["deepseek-chat"],
    keyHint: "sk-...",
    byok: true,
    note: "DeepSeek V3",
    keysUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "xai",
    label: "xAI · Grok",
    models: ["grok-2-latest"],
    keyHint: "xai-...",
    byok: true,
    note: "Grok",
    keysUrl: "https://console.x.ai",
  },
  {
    id: "together",
    label: "Together",
    models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
    keyHint: "...",
    byok: true,
    note: "Open models",
    keysUrl: "https://api.together.ai/settings/api-keys",
  },
];

export function providerDef(id: string): ProviderDef | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

export interface AiConfig {
  provider: string;
  model: string;
  /** Present only for BYOK providers; stored in this browser only. */
  apiKey?: string;
}

const STORAGE_KEY = "contextio.ai";

export function getAiConfig(): AiConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as AiConfig;
    return c.provider && c.model ? c : null;
  } catch {
    return null;
  }
}

export function setAiConfig(c: AiConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    window.dispatchEvent(new CustomEvent("contextio:ai", { detail: c }));
  } catch {
    /* ignore */
  }
}

export function clearAiConfig(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("contextio:ai", { detail: null }));
  } catch {
    /* ignore */
  }
}
