import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { PlanEntry } from '@/features/planner/api';
import { recipeCost, type CostableIngredient, type RecipeCost } from '@/features/pricing/recipe-cost';
import { usePriceIndex } from '@/features/pricing/use-recipe-cost';
import { supabase } from '@/lib/supabase/client';

interface RecipeCostInput {
  recipeId: string;
  servings: number;
  ingredients: CostableIngredient[];
}

/**
 * Batch-load the ingredients + base servings for a set of recipes (for costing
 * planned meals). Returns a plain array (not a Map) so it survives being
 * persisted to localStorage and rehydrated — a Map JSON-round-trips to `{}`.
 */
async function fetchRecipeCostInputs(ids: string[]): Promise<RecipeCostInput[]> {
  if (ids.length === 0) return [];

  const [{ data: recipes, error: rErr }, { data: rows, error: iErr }] = await Promise.all([
    supabase.from('recipe').select('id, servings').in('id', ids),
    supabase
      .from('recipe_ingredient')
      .select('recipe_id, canonical_ingredient_id, quantity, unit, is_optional')
      .in('recipe_id', ids),
  ]);
  if (rErr) throw rErr;
  if (iErr) throw iErr;

  const byId = new Map<string, RecipeCostInput>();
  for (const r of recipes ?? []) byId.set(r.id, { recipeId: r.id, servings: r.servings ?? 1, ingredients: [] });
  for (const row of rows ?? []) {
    byId.get(row.recipe_id)?.ingredients.push({
      canonicalId: row.canonical_ingredient_id,
      quantity: row.quantity,
      unit: row.unit,
      isOptional: row.is_optional,
    });
  }
  return [...byId.values()];
}

export interface EntryCost {
  cents: number | null;
  /** Per-serving cost (invariant to a servings override, since both scale together). */
  perServingCents: number | null;
  /** True when the meal is a recipe we couldn't fully price (no store, no prices, or missing facts). */
  unpriced: boolean;
}

export interface PlannerCosts {
  costForEntry: (entry: PlanEntry) => EntryCost;
  /** Summed cost of all priceable recipe meals in the given entries. */
  totalCents: number;
  pricedMeals: number;
  unpricedMeals: number;
  storeId: string | null;
  isLoading: boolean;
}

/**
 * Consumption cost for every recipe meal in a set of plan entries, at the
 * household's default store. Non-recipe entries (leftovers, eating out, notes)
 * contribute nothing. A meal's cost scales by its servings override.
 */
export function usePlannerCosts(entries: PlanEntry[]): PlannerCosts {
  const recipeIds = useMemo(
    () => [
      ...new Set(
        entries
          .filter((e) => e.kind === 'recipe' && e.recipeId)
          .map((e) => e.recipeId as string),
      ),
    ],
    [entries],
  );

  const { data: inputs, isLoading: inputsLoading } = useQuery({
    queryKey: ['recipe-cost-inputs', [...recipeIds].sort()],
    queryFn: () => fetchRecipeCostInputs(recipeIds),
    enabled: recipeIds.length > 0,
  });

  const canonicalIds = useMemo(() => {
    const s = new Set<string>();
    for (const v of inputs ?? []) for (const i of v.ingredients) if (i.canonicalId) s.add(i.canonicalId);
    return [...s];
  }, [inputs]);

  const index = usePriceIndex(canonicalIds);

  return useMemo(() => {
    const inputById = new Map((inputs ?? []).map((v) => [v.recipeId, v]));
    const costByRecipe = new Map<string, RecipeCost>();
    for (const v of inputs ?? []) {
      costByRecipe.set(
        v.recipeId,
        recipeCost(v.ingredients, v.servings, index.priceByCanonical, index.infoByCanonical),
      );
    }

    const costForEntry = (entry: PlanEntry): EntryCost => {
      if (entry.kind !== 'recipe' || !entry.recipeId)
        return { cents: null, perServingCents: null, unpriced: false };
      const rc = costByRecipe.get(entry.recipeId);
      const input = inputById.get(entry.recipeId);
      if (!rc || !input || rc.pricedCount === 0)
        return { cents: null, perServingCents: null, unpriced: true };
      const scale =
        entry.servingsOverride && input.servings ? entry.servingsOverride / input.servings : 1;
      return {
        cents: Math.round(rc.totalCents * scale),
        perServingCents: rc.perServingCents,
        unpriced: rc.unpricedCount > 0,
      };
    };

    let totalCents = 0;
    let pricedMeals = 0;
    let unpricedMeals = 0;
    for (const entry of entries) {
      if (entry.kind !== 'recipe' || !entry.recipeId) continue;
      const c = costForEntry(entry);
      if (c.cents == null) unpricedMeals += 1;
      else {
        totalCents += c.cents;
        pricedMeals += 1;
      }
    }

    return {
      costForEntry,
      totalCents,
      pricedMeals,
      unpricedMeals,
      storeId: index.storeId,
      isLoading: inputsLoading || index.isLoading,
    };
  }, [entries, inputs, index, inputsLoading]);
}
