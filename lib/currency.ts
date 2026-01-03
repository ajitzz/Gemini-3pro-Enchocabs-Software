// lib/currency.ts
/** Format number in Indian notation with ₹ sign (no decimals by default). */
export function formatINR(amount: number | string, withSymbol = true): string {
  const n = Number(amount) || 0;
  const f = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));
  return withSymbol ? `₹${f}` : f;
}

/** Safe number parse (accepts strings like "1,23,456"). */
export function parseNumberSafe(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") return Number(v.replace(/[,\s]/g, "")) || 0;
  return 0;
}
