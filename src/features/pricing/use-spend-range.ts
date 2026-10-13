import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useMemo } from 'react';

import { useHousehold } from '@/features/household/use-household';
import { useDiningInRange } from '@/features/planner/use-planner';
import { pricingKeys } from '@/features/pricing/api';
import { rollupSpend, type SpendRollup } from '@/features/pricing/spend';
import { usePriceIndex } from '@/features/pricing/use-recipe-cost';
import { fetchTripTotalsInRange, receiptKeys } from '@/features/receipts/api';
import { fetchOpenCheckedItems } from '@/features/shopping-list/api';

export interface SpendRange extends SpendRollup {
  storeId: string | null;
  isLoading: boolean;
}

/**
 * Actual grocery spend over [start, end] (yyyy-MM-dd, inclusive), by month: the
 * single source for the planner's budget bar and the spending page, so both read
 * the same number (ADR 0016).
 */
export function useSpendInRange(start: string, end: string): SpendRange {
  const { householdId } = useHousehold();

  const { data: trips, isLoading: tripsLoading } = useQuery({
    queryKey: receiptKeys.tripTotals(householdId ?? 'none', start, end),
    queryFn: () => fetchTripTotalsInRange(householdId as string, start, end),
    enabled: !!householdId,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: pricingKeys.openChecked(householdId ?? 'none', start, end),
    queryFn: () => fetchOpenCheckedItems(householdId as string, start, end),
    enabled: !!householdId,
  });

  const canonicalIds = useMemo(
    () => (items ?? []).map((i) => i.canonicalId).filter((id): id is string => !!id),
    [items],
  );
  const index = usePriceIndex(canonicalIds);

  // Eating out counts once its day arrives; later ones are forecast (ADR 0019).
  const { data: dining, isLoading: diningLoading } = useDiningInRange(start, end);
  const today = format(new Date(), 'yyyy-MM-dd');
  const diningSpent = useMemo(
    () => (dining ?? []).filter((d) => d.date <= today),
    [dining, today],
  );

  return useMemo(
    () => ({
      ...rollupSpend(
        trips ?? [],
        items ?? [],
        index.priceByCanonical,
        index.infoByCanonical,
        diningSpent,
      ),
      storeId: index.storeId,
      isLoading: tripsLoading || itemsLoading || diningLoading || index.isLoading,
    }),
    [trips, items, index, diningSpent, tripsLoading, itemsLoading, diningLoading],
  );
}
