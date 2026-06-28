/** Display formatters. Treasury base units are 7-dp Stellar units. */
const STELLAR_DECIMALS = 7;

export function fromBaseUnits(base: string, decimals = STELLAR_DECIMALS): number {
  return Number(BigInt(base)) / 10 ** decimals;
}

export function usd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function usdBase(base: string): string {
  return usd(fromBaseUnits(base));
}

export function bps(value: number): string {
  return `${(value / 100).toFixed(2)}%`;
}

export function shortHash(hash: string | null, head = 8, tail = 6): string {
  if (!hash) return "—";
  if (hash.length <= head + tail) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function relativeDate(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(days) >= 1) return rtf.format(days, "day");
  const hours = Math.round(diff / 3_600_000);
  return rtf.format(hours, "hour");
}

export const COUNTRY_LABEL: Record<string, string> = {
  BR: "🇧🇷 Brazil",
  AR: "🇦🇷 Argentina",
  CO: "🇨🇴 Colombia",
};

export const RAIL_LABEL: Record<string, string> = {
  PIX: "PIX",
  TRANSFERENCIAS_3: "Transferencias 3.0",
  BRE_B: "Bre-B",
  STELLAR: "Stellar (on-chain)",
  SEP24: "Anchor SEP-24",
  SEP31: "Anchor SEP-31",
};
