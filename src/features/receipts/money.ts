/** Dollars string ("4.19", "$1,299.00") -> integer cents (419), or null if blank/invalid. */
export function dollarsToCents(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t.replace(/[$,]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Integer cents -> a plain dollars string for editing (419 -> "4.19"). */
export function centsToDollars(c: number | null): string {
  return c == null ? '' : (c / 100).toFixed(2);
}
