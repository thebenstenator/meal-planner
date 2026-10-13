import { format } from 'date-fns';

import type { DiningSpend } from '@/features/planner/api';
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

/** A list item to price: a recorded actual price wins over the purchase estimate. */
export interface PriceableItem {
  canonicalId: string | null;
  quantity: number | null;
  unit: string | null;
  actualCostCents: number | null;
}

/**
 * A checked-off item no trip accounts for yet ("open" spend). Counted at its
 * recorded actual price, else the purchase-based estimate at current prices.
 */
export interface OpenCheckedItem extends PriceableItem {
  checkedAt: string; // ISO timestamp
  /** The list's category slug for the item, when it has one. */
  category: string | null;
}

/**
 * What an item costs (or cost): its recorded actual price, else the purchase
 * estimate at current prices. Null when it can't be priced.
 */
export function itemSpendCents(
  item: PriceableItem,
  priceByCanonical: Map<string, PriceInfo>,
  infoByCanonical: Map<string, ConversionInfo>,
): number | null {
  if (item.actualCostCents != null) return item.actualCostCents;
  const price = item.canonicalId ? priceByCanonical.get(item.canonicalId) : undefined;
  if (!price) return null;
  const info = (item.canonicalId && infoByCanonical.get(item.canonicalId)) || {};
  return estimateItemCost(item.quantity, item.unit, price, info);
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
 * links/archives the items it covers — so this sum never double-counts. Plus
 * eating-out meals that have happened (ADR 0019): the caller passes only those
 * dated on or before today; later ones are forecast, not spend.
 */
export function rollupSpend(
  trips: SpendTrip[],
  openItems: OpenCheckedItem[],
  priceByCanonical: Map<string, PriceInfo>,
  infoByCanonical: Map<string, ConversionInfo>,
  dining: DiningSpend[] = [],
): SpendRollup {
  const byMonth = new Map<string, number>();
  const add = (month: string, cents: number) =>
    byMonth.set(month, (byMonth.get(month) ?? 0) + cents);
  let unpricedCount = 0;

  for (const t of trips) add(t.purchasedOn.slice(0, 7), t.totalCents);
  for (const d of dining) add(d.date.slice(0, 7), d.cents);

  for (const item of openItems) {
    const cents = itemSpendCents(item, priceByCanonical, infoByCanonical);
    if (cents == null) unpricedCount += 1;
    else add(format(new Date(item.checkedAt), 'yyyy-MM'), cents);
  }

  return { byMonth, unpricedCount, openCount: openItems.length };
}
