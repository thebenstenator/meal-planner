import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useHousehold } from '@/features/household/use-household';
import { pricingKeys } from '@/features/pricing/api';
import { summarizeMonth, type MonthSummary } from '@/features/pricing/month-summary';
import { itemSpendCents } from '@/features/pricing/spend';
import { usePriceIndex } from '@/features/pricing/use-recipe-cost';
import { fetchTripsWithLines, receiptKeys } from '@/features/receipts/api';
import { fetchOpenCheckedItems } from '@/features/shopping-list/api';
import { deduceCategory, FALLBACK_CATEGORY } from '@/features/shopping-list/categories';
import { fetchIngredientCategories } from '@/features/shopping-list/categories-api';

export interface MonthSummaryResult extends MonthSummary {
  isLoading: boolean;
}

/**
 * Where one month's grocery money went, by shopping category (ADR 0017). Trip
 * lines take the same category a list item would — the household's override,
 * else the ingredient's own, else a guess from the name — so the breakdown
 * matches the aisles people see on their lists.
 */
export function useMonthSummary(monthStart: string, monthEnd: string): MonthSummaryResult {
  const { householdId } = useHousehold();
  const hid = householdId ?? 'none';

  const { data: trips, isLoading: tripsLoading } = useQuery({
    queryKey: receiptKeys.tripLines(hid, monthStart, monthEnd),
    queryFn: () => fetchTripsWithLines(hid, monthStart, monthEnd),
    enabled: !!householdId,
  });

  // Same query as the spend rollup, so this is usually a cache hit.
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: pricingKeys.openChecked(hid, monthStart, monthEnd),
    queryFn: () => fetchOpenCheckedItems(hid, monthStart, monthEnd),
    enabled: !!householdId,
  });

  const lineCanonicalIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of trips ?? []) for (const l of t.lines) if (l.canonicalId) ids.add(l.canonicalId);
    return [...ids].sort();
  }, [trips]);

  const { data: overrides, isLoading: overridesLoading } = useQuery({
    queryKey: ['ingredient-category-overrides', hid, lineCanonicalIds],
    queryFn: () => fetchIngredientCategories(hid, lineCanonicalIds),
    enabled: !!householdId && lineCanonicalIds.length > 0,
  });

  const itemCanonicalIds = useMemo(
    () => (items ?? []).map((i) => i.canonicalId).filter((id): id is string => !!id),
    [items],
  );
  const index = usePriceIndex(itemCanonicalIds);

  return useMemo(() => {
    const summary = summarizeMonth(
      (trips ?? []).map((t) => ({
        totalCents: t.totalCents,
        isEstimated: t.isEstimated,
        lines: t.lines.map((l) => ({
          category:
            (l.canonicalId && overrides?.[l.canonicalId]) ||
            l.canonicalCategory ||
            deduceCategory(l.rawText),
          priceCents: l.priceCents,
        })),
      })),
      (items ?? []).map((i) => ({
        category: i.category ?? FALLBACK_CATEGORY,
        cents: itemSpendCents(i, index.priceByCanonical, index.infoByCanonical),
        isRecorded: i.actualCostCents != null,
      })),
    );
    return {
      ...summary,
      isLoading:
        tripsLoading ||
        itemsLoading ||
        (lineCanonicalIds.length > 0 && overridesLoading) ||
        index.isLoading,
    };
  }, [trips, items, overrides, index, tripsLoading, itemsLoading, overridesLoading, lineCanonicalIds]);
}
