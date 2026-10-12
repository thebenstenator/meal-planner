import { useSpendInRange } from '@/features/pricing/use-spend-range';

export interface ActualSpend {
  /** Logged trips plus checked items no trip covers yet (what actually left the wallet). */
  actualCents: number;
  /** Open checked items counted on top of trips. */
  checkedCount: number;
  unpricedCount: number;
  storeId: string | null;
  isLoading: boolean;
}

/** Actual grocery spend for one calendar month — see useSpendInRange. */
export function useMonthActualSpend(monthStart: string, monthEnd: string): ActualSpend {
  const spend = useSpendInRange(monthStart, monthEnd);
  return {
    actualCents: spend.byMonth.get(monthStart.slice(0, 7)) ?? 0,
    checkedCount: spend.openCount,
    unpricedCount: spend.unpricedCount,
    storeId: spend.storeId,
    isLoading: spend.isLoading,
  };
}
