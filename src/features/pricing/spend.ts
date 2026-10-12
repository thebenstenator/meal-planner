import { format } from 'date-fns';

import {
  estimateItemCost,
  type ConversionInfo,
  type PriceInfo,
} from '@/features/pricing/price-item';

/** A logged grocery trip — the durable record of spend. */
export interface SpendTrip {
  purchasedOn: string; // yyyy-MM-dd
  totalCents: number;
}

/**
 * A checked-off item no trip accounts for yet ("open" spend). Counted at its
 * recorded actual price, else the purchase-based estimate at current prices.
 */
export interface OpenCheckedItem {
  canonicalId: string | null;
  quantity: number | null;
  unit: string | null;
  actualCostCents: number | null;
  checkedAt: string; // ISO timestamp
}

export interface SpendRollup {
  /** yyyy-MM → cents, for every month that had any spend. */
  byMonth: Map<string, number>;
  /** Open checked items that couldn't be priced (counted as $0). */
  unpricedCount: number;
  openCount: number;
}

/**
 * Actual spend by calendar month (ADR 0016): every logged trip by its purchase
 * date, plus checked items not yet covered by a trip, by the local day they were
 * checked off. Trips and open items never overlap — logging or clearing a trip
 * links/archives the items it covers — so this sum never double-counts.
 */
export function rollupSpend(
  trips: SpendTrip[],
  openItems: OpenCheckedItem[],
  priceByCanonical: Map<string, PriceInfo>,
  infoByCanonical: Map<string, ConversionInfo>,
): SpendRollup {
  const byMonth = new Map<string, number>();
  const add = (month: string, cents: number) =>
    byMonth.set(month, (byMonth.get(month) ?? 0) + cents);
  let unpricedCount = 0;

  for (const t of trips) add(t.purchasedOn.slice(0, 7), t.totalCents);

  for (const item of openItems) {
    const month = format(new Date(item.checkedAt), 'yyyy-MM');
    if (item.actualCostCents != null) {
      add(month, item.actualCostCents);
      continue;
    }
    const price = item.canonicalId ? priceByCanonical.get(item.canonicalId) : undefined;
    const info = (item.canonicalId && infoByCanonical.get(item.canonicalId)) || {};
    const cents = price ? estimateItemCost(item.quantity, item.unit, price, info) : null;
    if (cents == null) unpricedCount += 1;
    else add(month, cents);
  }

  return { byMonth, unpricedCount, openCount: openItems.length };
}
