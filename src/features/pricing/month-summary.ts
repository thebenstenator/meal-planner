/** A logged trip with its lines, each already resolved to a category slug. */
export interface SummaryTrip {
  totalCents: number;
  isEstimated: boolean;
  lines: Array<{ category: string; priceCents: number | null }>;
}

/** An open checked item, priced (null = couldn't be). */
export interface SummaryItem {
  category: string;
  cents: number | null;
  /** True when the price was recorded by the shopper rather than estimated. */
  isRecorded: boolean;
}

/** Spend that can't be pinned to a category: trip totals beyond their priced lines. */
export const UNITEMIZED = '__unitemized__';

export interface MonthSummary {
  totalCents: number;
  /** Category slug → cents, largest first. `UNITEMIZED` always sorts last. */
  byCategory: Array<{ category: string; cents: number }>;
  /** Portion of the total that comes from estimates rather than recorded prices. */
  estimatedCents: number;
}

/**
 * Where a month's money went (ADR 0017). Totals match the spend rollup: every
 * trip's total plus every priced open item. A trip's total is split across its
 * line categories; whatever its priced lines don't explain (tax, a typed total
 * with no item prices) is "not itemized". If the lines add up to more than the
 * total (coupons, a mis-scan), they're scaled down to it, so a trip is never
 * counted for more than was paid.
 */
export function summarizeMonth(trips: SummaryTrip[], items: SummaryItem[]): MonthSummary {
  const byCategory = new Map<string, number>();
  const add = (category: string, cents: number) => {
    if (cents > 0) byCategory.set(category, (byCategory.get(category) ?? 0) + cents);
  };
  let totalCents = 0;
  let estimatedCents = 0;

  for (const trip of trips) {
    totalCents += trip.totalCents;
    if (trip.isEstimated) estimatedCents += trip.totalCents;

    const priced = trip.lines.filter(
      (l): l is { category: string; priceCents: number } => l.priceCents != null && l.priceCents > 0,
    );
    const linesCents = priced.reduce((sum, l) => sum + l.priceCents, 0);

    if (linesCents <= trip.totalCents) {
      for (const l of priced) add(l.category, l.priceCents);
      add(UNITEMIZED, trip.totalCents - linesCents);
      continue;
    }
    // Scale down to the total, handing rounding leftovers to the biggest lines.
    const scale = trip.totalCents / linesCents;
    const shares = priced.map((l) => ({ ...l, cents: Math.floor(l.priceCents * scale) }));
    let leftover = trip.totalCents - shares.reduce((sum, s) => sum + s.cents, 0);
    for (const s of [...shares].sort((a, b) => b.priceCents - a.priceCents)) {
      if (leftover <= 0) break;
      s.cents += 1;
      leftover -= 1;
    }
    for (const s of shares) add(s.category, s.cents);
  }

  for (const item of items) {
    if (item.cents == null) continue;
    totalCents += item.cents;
    if (!item.isRecorded) estimatedCents += item.cents;
    add(item.category, item.cents);
  }

  const rows = [...byCategory].map(([category, cents]) => ({ category, cents }));
  rows.sort((a, b) => {
    if (a.category === UNITEMIZED) return 1;
    if (b.category === UNITEMIZED) return -1;
    return b.cents - a.cents;
  });
  return { totalCents, byCategory: rows, estimatedCents };
}
