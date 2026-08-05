import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useHousehold } from '@/features/household/use-household';
import { estimateItemCost } from '@/features/pricing/price-item';
import { usePriceIndex } from '@/features/pricing/use-recipe-cost';
import { fetchMonthCheckedItems } from '@/features/shopping-list/api';

export interface ActualSpend {
  /** Purchase-based cost of checked-off items in the month (what actually left the wallet). */
  actualCents: number;
  checkedCount: number;
  unpricedCount: number;
  storeId: string | null;
  isLoading: boolean;
}

/**
 * Actual grocery spend for a calendar month: purchase-based cost of the items the
 * household has checked off on shopping lists that overlap the month. Uses
 * current prices as the best available proxy (we don't capture receipts).
 */
export function useMonthActualSpend(monthStart: string, monthEnd: string): ActualSpend {
  const { householdId } = useHousehold();

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['month-checked-items', householdId ?? 'none', monthStart, monthEnd],
    queryFn: () => fetchMonthCheckedItems(householdId as string, monthStart, monthEnd),
    enabled: !!householdId,
  });

  const canonicalIds = useMemo(
    () => (items ?? []).map((i) => i.canonicalId).filter((id): id is string => !!id),
    [items],
  );
  const index = usePriceIndex(canonicalIds);

  return useMemo(() => {
    let actualCents = 0;
    let unpricedCount = 0;
    const checked = items ?? [];

    for (const item of checked) {
      const price = item.canonicalId ? index.priceByCanonical.get(item.canonicalId) : undefined;
      if (!price) {
        unpricedCount += 1;
        continue;
      }
      const info = (item.canonicalId && index.infoByCanonical.get(item.canonicalId)) || {};
      const cents = estimateItemCost(item.quantity, item.unit, price, info);
      if (cents == null) unpricedCount += 1;
      else actualCents += cents;
    }

    return {
      actualCents,
      checkedCount: checked.length,
      unpricedCount,
      storeId: index.storeId,
      isLoading: itemsLoading || index.isLoading,
    };
  }, [items, index, itemsLoading]);
}
