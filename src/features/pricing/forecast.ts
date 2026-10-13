import type { PlanEntry } from '@/features/planner/api';

/** Where a month sits relative to today: done, in progress, or ahead. */
export type MonthPhase = 'past' | 'current' | 'future';

export function monthPhase(monthStart: string, monthEnd: string, today: string): MonthPhase {
  if (monthEnd < today) return 'past';
  if (monthStart > today) return 'future';
  return 'current';
}

/**
 * First day still ahead in the month (inclusive) — today for the current month,
 * the 1st for a future one. Meaningless for a past month.
 */
export function remainingFrom(monthStart: string, today: string): string {
  return today > monthStart ? today : monthStart;
}

/**
 * Recipe meals from `from` onward that no shopping list shops for yet. A meal
 * inside a list's date range is already accounted for — its groceries are either
 * bought (in spend) or still on the list (in to-buy) — so counting its recipe
 * cost too would double it (ADR 0017).
 */
export function unlistedMeals(
  entries: PlanEntry[],
  listRanges: Array<{ start: string; end: string }>,
  from: string,
): PlanEntry[] {
  return entries.filter(
    (e) =>
      e.kind === 'recipe' &&
      !!e.recipeId &&
      e.date >= from &&
      !listRanges.some((r) => e.date >= r.start && e.date <= r.end),
  );
}

export interface MonthForecast {
  phase: MonthPhase;
  /** Where the month is headed: spent + still to buy + unlisted meals + eating out. */
  projectedCents: number;
  spentCents: number;
  /** Unchecked items on lists shopping for the rest of the month. */
  toBuyCents: number;
  /** Recipe cost of upcoming meals no list covers yet. */
  plannedCents: number;
  /** Eating-out meals still ahead (after today) — past ones are already spent. */
  diningCents: number;
}

/**
 * Sum the costs of eating-out meals dated after `today` — the forecast half of
 * dining; on or before today they're spend (ADR 0019).
 */
export function upcomingDiningCents(entries: PlanEntry[], today: string): number {
  return entries
    .filter((e) => e.kind === 'eating_out' && e.costCents != null && e.date > today)
    .reduce((sum, e) => sum + (e.costCents as number), 0);
}

/** Combine the parts. A finished month projects exactly what was spent. */
export function forecastMonth(
  phase: MonthPhase,
  spentCents: number,
  toBuyCents: number,
  plannedCents: number,
  diningCents = 0,
): MonthForecast {
  if (phase === 'past') {
    return {
      phase,
      projectedCents: spentCents,
      spentCents,
      toBuyCents: 0,
      plannedCents: 0,
      diningCents: 0,
    };
  }
  return {
    phase,
    projectedCents: spentCents + toBuyCents + plannedCents + diningCents,
    spentCents,
    toBuyCents,
    plannedCents,
    diningCents,
  };
}
