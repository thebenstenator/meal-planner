import { endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { useMemo } from 'react';

import { useHousehold } from '@/features/household/use-household';
import { useSpendInRange } from '@/features/pricing/use-spend-range';

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
 * Actual grocery spend for each of the last `months` calendar months — one
 * fetch for the whole window, same rollup as the planner's budget bar.
 */
export function useSpendHistory(months = 6): SpendHistory {
  const { household } = useHousehold();

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

  const spend = useSpendInRange(rangeStart, rangeEnd);

  return useMemo(
    () => ({
      rows: monthKeys.map((k) => ({
        month: k.month,
        label: k.label,
        actualCents: spend.byMonth.get(k.month) ?? 0,
      })),
      budgetCents: household?.monthlyBudgetCents ?? null,
      storeId: spend.storeId,
      isLoading: spend.isLoading,
    }),
    [monthKeys, spend, household?.monthlyBudgetCents],
  );
}

/** Exposed for tests/formatting: full month label from a yyyy-MM key. */
export function monthLabel(monthKey: string): string {
  return format(parseISO(`${monthKey}-01`), 'MMMM yyyy');
}
