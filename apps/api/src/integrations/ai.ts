import type { Logger } from "@contextio/shared";

/**
 * Known OpenAI-compatible providers. Every one of these speaks the OpenAI
 * `/chat/completions` wire format, so a single client targets all of them by
 * swapping the base URL. OpenRouter in particular routes to Claude, Gemini,
 * Grok, Llama, … through one endpoint — so this set genuinely covers "any AI".
 *
 * The base URLs are server-controlled (the client only sends a provider *id*,
 * never an arbitrary URL) — that keeps the BYOK path free of SSRF risk.
 */
export const AI_PROVIDERS = {
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  // Anthropic's OpenAI-compatible endpoint (Bearer auth, /chat/completions).
  // It doesn't support JSON response_format, so we rely on the prompt for JSON.
  anthropic: { label: "Anthropic (Claude)", baseUrl: "https://api.anthropic.com/v1", jsonMode: false },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  xai: { label: "xAI (Grok)", baseUrl: "https://api.x.ai/v1" },
  together: { label: "Together", baseUrl: "https://api.together.xyz/v1" },
} as const;
export type AiProvider = keyof typeof AI_PROVIDERS;

export interface AiAdvisorConfig {
  provider: "none" | "openai";
  model: string;
  apiKey?: string;
  baseUrl: string;
}

/** The decision context handed to the LLM. All amounts are human units (not base units). */
export interface AiPlanContext {
  action: string;
  amount: string;
  asset: string;
  liquid: string;
  requiredLiquidity: string;
  currentYield: string;
  obligationSum: string;
  fxPair: string;
  fxVolatility: number;
  country: string;
}

/** Per-request bring-your-own-key override (from the dashboard AI selector). */
export interface AiOverride {
  provider?: string;
  model?: string;
  apiKey?: string;
}

export interface AiAdvice {
  rationale: string;
  risk: string | null;
}

/** Hard ceiling so a slow upstream never blocks the agent's on-chain settlement. */
const REQUEST_TIMEOUT_MS = 12_000;

const SYSTEM_PROMPT = [
  "You are the reasoning layer of Contextio, an autonomous, non-custodial treasury agent on the Stellar network for small businesses in LATAM.",
  "A deterministic risk engine has ALREADY chosen the action and the amount — you do NOT change either of them, you explain them.",
  "Given the decision context as JSON, write a concise, professional rationale (in English) that a CFO would trust:",
  "tie the move to liquidity vs. upcoming payroll obligations, the FX-volatility buffer, and the yield opportunity.",
  'Respond ONLY with compact JSON of the form {"rationale": "<1-2 sentences>", "risk": "<one short caveat, or null>"}.',
].join(" ");

/**
 * The agent's reasoning layer.
 *
 * Given a deterministic rebalance proposal and the treasury context, an LLM
 * writes the human-readable rationale (and an optional one-line risk note). It
 * NEVER changes the action or the amount and never bypasses the risk limits —
 * the on-chain decision stays deterministic and auditable; the LLM only
 * explains it. Any failure (no key, timeout, bad payload) returns `null` so the
 * caller falls back to the deterministic rationale and the agent keeps working.
 *
 * Two ways to drive it:
 *  - **Server default** (`AI_PROVIDER`/`OPENAI_API_KEY`): used by the autonomous
 *    24/7 Fly agent for auto-rebalance / lending. OpenAI today.
 *  - **Per-request BYOK override** (`{provider, model, apiKey}`): the dashboard
 *    AI selector lets a user run the agent with any provider's own key.
 */
export class AiAdvisor {
  readonly live: boolean;
  readonly provider: string;
  readonly model: string;
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(
    cfg: AiAdvisorConfig,
    private readonly logger: Logger,
  ) {
    this.provider = cfg.provider;
    this.model = cfg.model;
    this.apiKey = cfg.apiKey;
    this.baseUrl = cfg.baseUrl.replace(/\/$/, "");
    this.live = cfg.provider === "openai" && Boolean(cfg.apiKey);
  }

  /**
   * Produce an AI rationale for a decision. A BYOK `override` (provider + key)
   * targets any known provider for one request; otherwise the server-configured
   * provider is used. Returns `null` on any failure.
   */
  async advise(ctx: AiPlanContext, override?: AiOverride): Promise<AiAdvice | null> {
    let baseUrl = this.baseUrl;
    let apiKey = this.apiKey;
    let model = this.model;
    let provider = this.provider;

    if (override?.apiKey && override.provider) {
      const known = AI_PROVIDERS[override.provider as AiProvider];
      if (!known) {
        this.logger.warn({ provider: override.provider }, "Unknown AI provider — ignoring BYOK override");
        return null;
      }
      baseUrl = known.baseUrl;
      apiKey = override.apiKey;
      model = override.model || this.model;
      provider = override.provider;
    } else if (override?.model) {
      // Same (server) provider, just a different model.
      model = override.model;
    }

    if (!apiKey) return null;

    // A few providers (Anthropic's compat endpoint) reject JSON response_format;
    // they still return JSON because the system prompt mandates it.
    const useJsonMode = (AI_PROVIDERS as Record<string, { jsonMode?: boolean }>)[provider]?.jsonMode !== false;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
          // Optional attribution headers OpenRouter recommends; ignored elsewhere.
          "HTTP-Referer": "https://contextio.xyz",
          "X-Title": "Contextio",
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 220,
          ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(ctx) },
          ],
        }),
      });
      if (!res.ok) {
        this.logger.warn({ status: res.status, provider }, "AI advisor request failed — using deterministic rationale");
        return null;
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content;
      if (!content) return null;
      const parsed = JSON.parse(content) as { rationale?: unknown; risk?: unknown };
      if (typeof parsed.rationale !== "string" || !parsed.rationale.trim()) return null;
      const risk = typeof parsed.risk === "string" && parsed.risk.trim() ? parsed.risk.trim() : null;
      return { rationale: parsed.rationale.trim(), risk };
    } catch (e) {
      this.logger.warn({ err: e instanceof Error ? e.message : String(e) }, "AI advisor deferred");
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
