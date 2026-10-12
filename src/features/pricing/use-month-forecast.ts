import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useMemo } from 'react';

import { useHousehold } from '@/features/household/use-household';
import type { PlanEntry } from '@/features/planner/api';
import {
  forecastMonth,
  monthPhase,
  remainingFrom,
  unlistedMeals,
  type MonthForecast,
} from '@/features/pricing/forecast';
import { itemSpendCents } from '@/features/pricing/spend';
import { usePlannerCosts } from '@/features/pricing/use-planner-cost';
import { usePriceIndex } from '@/features/pricing/use-recipe-cost';
import { fetchToBuy } from '@/features/shopping-list/api';

export interface MonthForecastResult extends MonthForecast {
  /** To-buy items and unlisted meals that couldn't be priced (left out of the projection). */
  unpricedCount: number;
  isLoading: boolean;
}

/**
 * Where the month is headed (ADR 0017): what's been spent, plus what's still on
 * the lists shopping for the rest of the month, plus the recipe cost of upcoming
 * meals no list covers yet. `monthEntries` are the month's plan entries and
 * `spentCents` its actual spend — both already loaded by the caller.
 */
export function useMonthForecast(
  monthStart: string,
  monthEnd: string,
  monthEntries: PlanEntry[],
  spentCents: number,
): MonthForecastResult {
  const { householdId } = useHousehold();
  const today = format(new Date(), 'yyyy-MM-dd');
  const phase = monthPhase(monthStart, monthEnd, today);
  const from = remainingFrom(monthStart, today);
  // Running and store lists have no dates; they count toward this month only.
  const includeUndated = phase === 'current';

  const { data, isLoading: toBuyLoading } = useQuery({
    // Under the open-checked-items head so check-offs and trips refresh it.
    queryKey: ['open-checked-items', 'to-buy', householdId ?? 'none', from, monthEnd, includeUndated],
    queryFn: () => fetchToBuy(householdId as string, from, monthEnd, includeUndated),
    enabled: !!householdId && phase !== 'past',
  });

  const canonicalIds = useMemo(
    () => (data?.items ?? []).map((i) => i.canonicalId).filter((id): id is string => !!id),
    [data],
  );
  const index = usePriceIndex(canonicalIds);

  const unlisted = useMemo(
    () => (phase === 'past' ? [] : unlistedMeals(monthEntries, data?.listRanges ?? [], from)),
    [phase, monthEntries, data, from],
  );
  const mealCosts = usePlannerCosts(unlisted);

  return useMemo(() => {
    let toBuyCents = 0;
    let unpricedCount = mealCosts.unpricedMeals;
    for (const item of data?.items ?? []) {
      const cents = itemSpendCents(item, index.priceByCanonical, index.infoByCanonical);
      if (cents == null) unpricedCount += 1;
      else toBuyCents += cents;
    }
    return {
      ...forecastMonth(phase, spentCents, toBuyCents, mealCosts.totalCents),
      unpricedCount: phase === 'past' ? 0 : unpricedCount,
      isLoading: phase !== 'past' && (toBuyLoading || index.isLoading || mealCosts.isLoading),
    };
  }, [phase, spentCents, data, index, mealCosts, toBuyLoading]);
}
