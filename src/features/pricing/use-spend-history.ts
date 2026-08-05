import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { useMemo } from 'react';

import { useHousehold } from '@/features/household/use-household';
import { estimateItemCost } from '@/features/pricing/price-item';
import { usePriceIndex } from '@/features/pricing/use-recipe-cost';
import { fetchCheckedItemsByMonth } from '@/features/shopping-list/api';

export interface MonthSpend {
  month: string; // yyyy-MM
  label: string; // e.g. "Aug"
  actualCents: number;
}

export interface SpendHistory {
  rows: MonthSpend[];
  budgetCents: number | null;
  storeId: string | null;
  isLoading: boolean;
}

/**
 * Actual grocery spend for each of the last `months` calendar months (purchase
 * cost of checked-off items, attributed to their list's month). One fetch + one
 * price index for the whole window.
 */
export function useSpendHistory(months = 6): SpendHistory {
  const { householdId, household } = useHousehold();

  // Stable month keys for the window (recomputed once per mount).
  const { rangeStart, rangeEnd, monthKeys } = useMemo(() => {
    const now = new Date();
    const keys: { month: string; label: string }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(now, i);
      keys.push({ month: format(d, 'yyyy-MM'), label: format(d, 'MMM') });
    }
    return {
      rangeStart: format(startOfMonth(subMonths(now, months - 1)), 'yyyy-MM-dd'),
      rangeEnd: format(endOfMonth(now), 'yyyy-MM-dd'),
      monthKeys: keys,
    };
  }, [months]);

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['spend-history', householdId ?? 'none', rangeStart, rangeEnd],
    queryFn: () => fetchCheckedItemsByMonth(householdId as string, rangeStart, rangeEnd),
    enabled: !!householdId,
  });

  const canonicalIds = useMemo(
    () => (items ?? []).map((i) => i.canonicalId).filter((id): id is string => !!id),
    [items],
  );
  const index = usePriceIndex(canonicalIds);

  return useMemo(() => {
    const byMonth = new Map<string, number>(monthKeys.map((k) => [k.month, 0]));

    for (const item of items ?? []) {
      if (!byMonth.has(item.month)) continue;
      const price = item.canonicalId ? index.priceByCanonical.get(item.canonicalId) : undefined;
      if (!price) continue;
      const info = (item.canonicalId && index.infoByCanonical.get(item.canonicalId)) || {};
      const cents = estimateItemCost(item.quantity, item.unit, price, info);
      if (cents != null) byMonth.set(item.month, (byMonth.get(item.month) ?? 0) + cents);
    }

    const rows: MonthSpend[] = monthKeys.map((k) => ({
      month: k.month,
      label: k.label,
      actualCents: byMonth.get(k.month) ?? 0,
    }));

    return {
      rows,
      budgetCents: household?.monthlyBudgetCents ?? null,
      storeId: index.storeId,
      isLoading: itemsLoading || index.isLoading,
    };
  }, [items, index, monthKeys, household?.monthlyBudgetCents, itemsLoading]);
}

/** Exposed for tests/formatting: full month label from a yyyy-MM key. */
export function monthLabel(monthKey: string): string {
  return format(parseISO(`${monthKey}-01`), 'MMMM yyyy');
}
