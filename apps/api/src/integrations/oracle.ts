import { type Logger } from "@contextio/shared";
import type { ServerEnv } from "@contextio/config";
import type { Country } from "@contextio/shared";

/**
 * FX + yield oracle abstraction. The mock provider returns deterministic,
 * plausible rates with mild day-seeded volatility so the agent's volatility
 * sensitivity logic is exercisable offline. A real provider (e.g. an on-chain
 * Reflector/Blend oracle, or a licensed FX feed) implements the same interface.
 */
export interface FxQuote {
  pair: string;
  /** Units of local currency per 1 USD. */
  rate: number;
  /** Annualized volatility estimate, 0–1. */
  volatility: number;
  asOf: string;
}

export interface YieldQuote {
  source: "defindex" | "blend";
  strategyRef: string;
  apyBps: number;
  asOf: string;
}

export interface Oracle {
  getFx(country: Country): Promise<FxQuote>;
  getYield(source: "defindex" | "blend", strategyRef: string): Promise<YieldQuote>;
}

const USD_PER: Record<Country, { pair: string; base: number; vol: number }> = {
  BR: { pair: "USD/BRL", base: 5.45, vol: 0.12 },
  AR: { pair: "USD/ARS", base: 1015.0, vol: 0.38 },
  CO: { pair: "USD/COP", base: 4100.0, vol: 0.14 },
};

class MockOracle implements Oracle {
  async getFx(country: Country): Promise<FxQuote> {
    const cfg = USD_PER[country];
    // Day-seeded deterministic wiggle so repeated calls within a day are stable.
    const daySeed = Math.floor(Date.now() / 86_400_000);
    const wiggle = Math.sin(daySeed + country.charCodeAt(0)) * cfg.vol * 0.05;
    return {
      pair: cfg.pair,
      rate: Number((cfg.base * (1 + wiggle)).toFixed(4)),
      volatility: cfg.vol,
      asOf: new Date().toISOString(),
    };
  }

  async getYield(source: "defindex" | "blend", strategyRef: string): Promise<YieldQuote> {
    const base = source === "defindex" ? 1075 : 540;
    return { source, strategyRef, apyBps: base, asOf: new Date().toISOString() };
  }
}

class HttpOracle implements Oracle {
  constructor(
    private readonly url: string,
    private readonly apiKey: string | undefined,
    private readonly fallback: Oracle,
    private readonly logger: Logger,
  ) {}

  async getFx(country: Country): Promise<FxQuote> {
    try {
      const res = await fetch(`${this.url}/fx?country=${country}`, {
        headers: this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {},
      });
      if (!res.ok) throw new Error(`FX provider ${res.status}`);
      return (await res.json()) as FxQuote;
    } catch (e) {
      this.logger.warn({ err: String(e) }, "FX provider failed; using mock fallback");
      return this.fallback.getFx(country);
    }
  }

  getYield(source: "defindex" | "blend", strategyRef: string): Promise<YieldQuote> {
    return this.fallback.getYield(source, strategyRef);
  }
}

export function createOracle(config: ServerEnv, logger: Logger): Oracle {
  const mock = new MockOracle();
  if (config.FX_PROVIDER === "http" && config.FX_API_URL) {
    return new HttpOracle(config.FX_API_URL, config.FX_API_KEY || undefined, mock, logger);
  }
  return mock;
}
