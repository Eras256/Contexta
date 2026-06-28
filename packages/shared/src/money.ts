/**
 * Money helpers. On-chain Stellar amounts are integers in stroops/base units
 * (7 decimal places for classic assets). We keep human values as strings to
 * avoid float drift, and convert to bigint base units for contract calls.
 */

export const STELLAR_DECIMALS = 7;

export function toBaseUnits(amount: string | number, decimals = STELLAR_DECIMALS): bigint {
  const s = typeof amount === "number" ? amount.toString() : amount.trim();
  if (!/^-?\d+(\.\d+)?$/u.test(s)) {
    throw new Error(`Invalid decimal amount: ${amount}`);
  }
  const negative = s.startsWith("-");
  const [whole, frac = ""] = s.replace("-", "").split(".");
  const paddedFrac = (frac + "0".repeat(decimals)).slice(0, decimals);
  const combined = `${whole}${paddedFrac}`.replace(/^0+(?=\d)/u, "");
  const value = BigInt(combined === "" ? "0" : combined);
  return negative ? -value : value;
}

export function fromBaseUnits(base: bigint, decimals = STELLAR_DECIMALS): string {
  const negative = base < 0n;
  const abs = (negative ? -base : base).toString().padStart(decimals + 1, "0");
  const whole = abs.slice(0, abs.length - decimals);
  const frac = abs.slice(abs.length - decimals).replace(/0+$/u, "");
  const sign = negative ? "-" : "";
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
}

/** Basis points helper used by risk parameters (e.g. 2500 bps = 25%). */
export function applyBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(Math.round(bps))) / 10_000n;
}
