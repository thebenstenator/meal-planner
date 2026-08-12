import { differenceInCalendarDays, parseISO } from 'date-fns';

import type { LibraryRecipe } from '@/features/planner/autofill';

/** Calendar days from `from` to `to` (both yyyy-MM-dd). Positive = to is later. */
export function daysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/**
 * How an expiry reads to a person: "expires tomorrow", not a date. Shared by the
 * "use it up" dashboard card and the pantry rows so the same item never reads two
 * different ways in two places.
 */
export function expiryLabel(daysLeft: number): string {
  if (daysLeft < 0) return `expired ${-daysLeft}d ago`;
  if (daysLeft === 0) return 'expires today';
  if (daysLeft === 1) return 'expires tomorrow';
  return `expires in ${daysLeft}d`;
}

// A recipe cooked within this many days is "recent" — not a candidate for the
// haven't-made-in-a-while nudge.
const RECENT_DAYS = 21;

/** How strongly to surface a stale recipe: staleness, then favorite / most-cooked. */
export function staleScore(r: LibraryRecipe, today: string): number {
  const staleDays = r.lastCookedOn ? Math.max(0, daysBetween(r.lastCookedOn, today)) : 120;
  const stale = Math.min(staleDays, 180) / 30; // 0..6
  const fav = r.isFavorite ? 2 : 0;
  const liked = Math.min(r.timesCooked, 5) * 0.4;
  return stale + fav + liked;
}

/**
 * Recipes the household has cooked before but not recently — the "you haven't
 * made this in a while" nudge. Never-cooked recipes are excluded (that's "new",
 * not "in a while"). Ranked by staleness, then favorite / most-cooked.
 */
export function staleRecipes(
  library: LibraryRecipe[],
  today: string,
  limit = 4,
): LibraryRecipe[] {
  return library
    .filter((r) => {
      const cookedBefore = r.timesCooked > 0 || r.lastCookedOn != null;
      if (!cookedBefore) return false;
      if (r.lastCookedOn == null) return true; // cooked, date unknown
      return daysBetween(r.lastCookedOn, today) >= RECENT_DAYS;
    })
    .map((r) => ({ r, score: staleScore(r, today) }))
    .sort((a, b) => b.score - a.score || a.r.id.localeCompare(b.r.id))
    .slice(0, limit)
    .map((x) => x.r);
}

export interface ExpiringInput {
  id: string;
  canonicalName: string;
  expiresOn: string | null;
}

export interface ExpiringItem {
  id: string;
  canonicalName: string;
  expiresOn: string;
  /** Days until it expires; 0 = today, negative = already expired. */
  daysLeft: number;
}

/**
 * Pantry items expiring within `withinDays` (or already expired) — the
 * "use it up" nudge. Soonest (and already-expired) first.
 */
export function expiringItems(
  items: ExpiringInput[],
  today: string,
  withinDays = 5,
): ExpiringItem[] {
  return items
    .flatMap((i) =>
      i.expiresOn == null
        ? []
        : [{ id: i.id, canonicalName: i.canonicalName, expiresOn: i.expiresOn, daysLeft: daysBetween(today, i.expiresOn) }],
    )
    .filter((x) => x.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export interface PlannedRecipe {
  recipeId: string | null;
  recipeTitle: string | null;
}

export interface VarietyInsight {
  /** Recipe-kind meals planned in the window. */
  plannedRecipeMeals: number;
  distinctRecipes: number;
  /** Recipes planned 2+ times in the window, most-repeated first. */
  repeats: { title: string; count: number }[];
}

/**
 * Variety of planned recipe meals in a window — powers the "mix it up" nudge
 * when the same recipe shows up several times in one week.
 */
export function weekVariety(entries: PlannedRecipe[]): VarietyInsight {
  const counts = new Map<string, { title: string; count: number }>();
  let planned = 0;
  for (const e of entries) {
    if (!e.recipeId) continue;
    planned += 1;
    const existing = counts.get(e.recipeId);
    if (existing) existing.count += 1;
    else counts.set(e.recipeId, { title: e.recipeTitle ?? 'A recipe', count: 1 });
  }
  const repeats = [...counts.values()]
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  return { plannedRecipeMeals: planned, distinctRecipes: counts.size, repeats };
}
