import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useHousehold } from '@/features/household/use-household';
import {
  expiringItems,
  staleRecipes,
  weekVariety,
  type ExpiringItem,
  type VarietyInsight,
} from '@/features/insights/insights';
import { usePantry } from '@/features/pantry/use-pantry';
import type { LibraryRecipe } from '@/features/planner/autofill';
import { toISO, weekRange } from '@/features/planner/dates';
import { usePlanEntries } from '@/features/planner/use-planner';
import { listLibraryForAutofill } from '@/features/recipes/api';

export interface Insights {
  stale: LibraryRecipe[];
  expiring: ExpiringItem[];
  variety: VarietyInsight;
  /** True when there's genuinely nothing worth surfacing. */
  empty: boolean;
  isLoading: boolean;
}

/**
 * The smart-surfacing signals for the home dashboard: recipes you haven't made
 * in a while, pantry items to use up, and this week's variety. All derived from
 * data already in the app — no AI.
 */
export function useInsights(): Insights {
  const { householdId } = useHousehold();
  const today = toISO(new Date());
  const { start, end } = weekRange(new Date());

  const { data: library, isLoading: libLoading } = useQuery({
    queryKey: ['insights-library', householdId ?? 'none'],
    queryFn: () => listLibraryForAutofill(householdId as string),
    enabled: !!householdId,
  });
  const { data: pantry, isLoading: pantryLoading } = usePantry();
  const { data: week, isLoading: weekLoading } = usePlanEntries(start, end);

  return useMemo(() => {
    const stale = staleRecipes(library ?? [], today, 4);
    const expiring = expiringItems(pantry ?? [], today, 5);
    const variety = weekVariety(
      (week ?? [])
        .filter((e) => e.kind === 'recipe')
        .map((e) => ({ recipeId: e.recipeId, recipeTitle: e.recipeTitle })),
    );
    const empty = stale.length === 0 && expiring.length === 0 && variety.repeats.length === 0;
    return {
      stale,
      expiring,
      variety,
      empty,
      isLoading: libLoading || pantryLoading || weekLoading,
    };
  }, [library, pantry, week, today, libLoading, pantryLoading, weekLoading]);
}
