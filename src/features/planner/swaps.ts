import { addDays, format, parseISO } from 'date-fns';

import { eligibleFor, libraryScore, type LibraryRecipe } from '@/features/planner/autofill';
import type { PlanEntry } from '@/features/planner/api';

/** A recipe's cost per serving, and whether every ingredient was priced. */
export interface ServingCost {
  perServingCents: number | null;
  /** Some ingredients unpriced — the figure is a floor, not a real price. */
  unpriced: boolean;
}

export interface SwapSuggestion {
  entryId: string;
  date: string;
  slot: PlanEntry['slot'];
  fromTitle: string;
  toRecipeId: string;
  toTitle: string;
  /** What the meal saves at its planned servings. */
  savingsCents: number;
}

/** A swap has to be worth the bother: at least this much, and this share. */
export const MIN_SAVINGS_CENTS = 200;
export const MIN_SAVINGS_SHARE = 0.2;

/**
 * Cheaper swaps for upcoming planned meals (ADR 0020). For each recipe meal from
 * today on, the best-liked recipe that fits the slot (same rule as auto-fill),
 * costs meaningfully less per serving, and isn't already planned the day before
 * or after in that slot — so a swap never creates a back-to-back repeat. Both
 * sides must be fully priced: a saving computed against a partial price is
 * just a missing price. Largest savings first, one suggestion per meal.
 */
export function suggestSwaps(
  entries: PlanEntry[],
  library: LibraryRecipe[],
  costOf: (recipeId: string) => ServingCost | undefined,
  today: string,
  limit = 5,
): SwapSuggestion[] {
  const priced = (id: string) => {
    const c = costOf(id);
    return c && c.perServingCents != null && !c.unpriced ? c.perServingCents : null;
  };
  const ranked = [...library].sort((a, b) => {
    const d = libraryScore(b, today) - libraryScore(a, today);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
  const servingsOf = new Map(library.map((r) => [r.id, r.servings ?? 1]));
  const recipeAt = new Map<string, string>();
  for (const e of entries) if (e.recipeId) recipeAt.set(`${e.date}|${e.slot}`, e.recipeId);
  const near = (date: string, slot: string) => {
    const d = parseISO(date);
    return [-1, 1]
      .map((n) => recipeAt.get(`${format(addDays(d, n), 'yyyy-MM-dd')}|${slot}`))
      .filter((id): id is string => !!id);
  };

  const out: SwapSuggestion[] = [];
  for (const e of entries) {
    if (e.kind !== 'recipe' || !e.recipeId || e.date < today || e.cookedAt) continue;
    const current = priced(e.recipeId);
    if (current == null) continue;
    const servings = e.servingsOverride ?? servingsOf.get(e.recipeId) ?? 1;
    const neighbors = near(e.date, e.slot);

    const pick = ranked.find((r) => {
      if (r.id === e.recipeId || neighbors.includes(r.id) || !eligibleFor(r, e.slot)) return false;
      const cost = priced(r.id);
      if (cost == null) return false;
      const saved = current - cost;
      return saved * servings >= MIN_SAVINGS_CENTS && saved >= current * MIN_SAVINGS_SHARE;
    });
    if (!pick) continue;

    out.push({
      entryId: e.id,
      date: e.date,
      slot: e.slot,
      fromTitle: e.recipeTitle ?? 'Recipe',
      toRecipeId: pick.id,
      toTitle: pick.title,
      savingsCents: (current - (priced(pick.id) as number)) * servings,
    });
  }

  return out.sort((a, b) => b.savingsCents - a.savingsCents).slice(0, limit);
}
