import type { Slot } from '@/schemas/plan';
import type { MealType } from '@/schemas/recipe';

export interface LibraryRecipe {
  id: string;
  title: string;
  isFavorite: boolean;
  timesCooked: number;
  lastCookedOn: string | null; // yyyy-MM-dd
  /** What this recipe can fill. Never empty in practice — the autofill query
   * falls back to a title guess so an untagged recipe still lands somewhere. */
  mealTypes: MealType[];
  /** Base servings, where known — what a planned meal of it serves. */
  servings?: number;
}

/**
 * Which recipe meal types are allowed to fill each planner slot. Dinner and
 * lunch draw strictly from mains, so a sauce, dessert or drink can never be
 * proposed for them; the sweeter/lighter types have their own homes. A recipe is
 * eligible for a slot if any of its meal types appears here.
 */
export const SLOT_MEAL_TYPES: Record<Slot, MealType[]> = {
  breakfast: ['breakfast'],
  lunch: ['main'],
  dinner: ['main'],
  snack: ['snack', 'dessert', 'drink'],
};

export function eligibleFor(recipe: LibraryRecipe, slot: Slot): boolean {
  const allowed = SLOT_MEAL_TYPES[slot];
  return recipe.mealTypes.some((t) => allowed.includes(t));
}

export type NoveltyLevel = 'all-favorites' | 'few-new' | 'many-new';

/** Approximate number of fresh (AI) ideas per week for each novelty level. */
export const NOVELTY_PER_WEEK: Record<NoveltyLevel, number> = {
  'all-favorites': 0,
  'few-new': 1,
  'many-new': 2.5,
};

export interface AutofillParams {
  /** Days to fill (yyyy-MM-dd), in order. */
  days: string[];
  /** Which slots per day to fill (e.g. ['dinner'] or all). */
  slots: Slot[];
  library: LibraryRecipe[];
  /** How many fresh AI ideas are available to place. */
  aiIdeaCount: number;
  novelty: NoveltyLevel;
  /** yyyy-MM-dd, for "haven't made in a while" staleness. */
  today: string;
  /** Cells that already have a meal — never proposed over, and no budget spent on them. */
  isOccupied?: (date: string, slot: Slot) => boolean;
  /**
   * Keep the proposal's total under `cents` (ADR 0018), costing each meal with
   * `cost` (see mealCostModel). Omitted = the plain balanced plan.
   */
  budget?: { cents: number; cost: (recipeId: string | undefined, slot: Slot) => MealCost };
}

export interface Assignment {
  date: string;
  slot: Slot;
  source: 'library' | 'ai';
  /** Set when source==='library'. */
  recipeId?: string;
  /** Index into the AI-ideas list, set when source==='ai'. */
  aiIndex?: number;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** Higher = better pick. Favorites and most-cooked are boosted; so is anything
 * not made in a long time. */
export function libraryScore(r: LibraryRecipe, today: string): number {
  const fav = r.isFavorite ? 3 : 0;
  const liked = Math.min(r.timesCooked, 5) * 0.3;
  const staleDays = r.lastCookedOn ? Math.max(0, daysBetween(r.lastCookedOn, today)) : 365;
  const stale = Math.min(staleDays, 180) / 60;
  return fav + liked + stale;
}

/** How many fresh AI ideas to place for a set of days at a novelty level. */
export function aiTargetForDays(days: number, novelty: NoveltyLevel): number {
  return Math.round((NOVELTY_PER_WEEK[novelty] * days) / 7);
}

/**
 * Propose a balanced set of meals for the given days + slots — no AI here, this
 * is pure placement. Each slot draws only from recipes eligible for it (dinner
 * from mains, never a sauce or dessert — see SLOT_MEAL_TYPES). Ranks the library
 * by favorite / most-cooked / haven't-made-in-a-while, spreads a target number of
 * fresh AI ideas evenly through the month, and avoids repeating the same recipe
 * on adjacent slots. Deterministic (stable tiebreak by id) so it's testable and a
 * re-run is predictable.
 *
 * With a budget, each cell gets an allowance — what's left of the budget over the
 * cells left — and takes the next recipe in its rotation that fits it, else the
 * cheapest one that isn't a repeat. Cheap meals bank slack that lets a pricier
 * favorite back in later, so favorites appear wherever the money allows; with a
 * generous budget the plan is identical to the unbudgeted one. Building in order
 * (rather than swapping meals after) keeps the no-repeat rule satisfiable even
 * for a small library.
 */
export function buildMonthPlan(p: AutofillParams): Assignment[] {
  const cells: { date: string; slot: Slot }[] = [];
  for (const date of p.days)
    for (const slot of p.slots) if (!p.isOccupied?.(date, slot)) cells.push({ date, slot });
  const total = cells.length;
  if (total === 0) return [];

  const newTarget = Math.max(
    0,
    Math.min(p.aiIdeaCount, aiTargetForDays(p.days.length, p.novelty), total),
  );

  // AI slots, spread evenly through the month.
  const aiAt = new Set<number>();
  if (newTarget > 0) {
    const step = total / newTarget;
    for (let i = 0; i < newTarget; i++) {
      aiAt.add(Math.min(total - 1, Math.floor(i * step + step / 2)));
    }
    for (let i = 0; aiAt.size < newTarget && i < total; i++) aiAt.add(i);
  }

  const ranked = [...p.library].sort((a, b) => {
    const d = libraryScore(b, p.today) - libraryScore(a, p.today);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });

  // Each slot draws from its own pool of eligible recipes (dinner from mains,
  // etc.), with its own cursor so a small pool doesn't stall the whole month.
  const poolBySlot = new Map<Slot, LibraryRecipe[]>();
  const cursorBySlot = new Map<Slot, number>();
  for (const slot of p.slots) {
    poolBySlot.set(
      slot,
      ranked.filter((r) => eligibleFor(r, slot)),
    );
    cursorBySlot.set(slot, 0);
  }

  const out: Assignment[] = [];
  let aiCursor = 0;
  const recent: string[] = [];
  const window = Math.min(Math.max(0, ranked.length - 1), p.slots.length + 1);

  let remaining = p.budget?.cents ?? Infinity;
  const costOf = (recipeId: string | undefined, slot: Slot) =>
    p.budget ? p.budget.cost(recipeId, slot).cents : 0;

  for (let i = 0; i < total; i++) {
    const cell = cells[i] as { date: string; slot: Slot };
    const pool = poolBySlot.get(cell.slot) ?? [];
    const wantAi = aiAt.has(i) && aiCursor < newTarget;

    if (wantAi || pool.length === 0) {
      if (aiCursor < p.aiIdeaCount) {
        out.push({ date: cell.date, slot: cell.slot, source: 'ai', aiIndex: aiCursor++ });
        remaining -= costOf(undefined, cell.slot);
      }
      continue; // nothing eligible and no AI left -> leave the slot empty
    }

    // Next recipe in this slot's pool not used in the recent window that fits
    // the allowance. Failing that (budget only), the cheapest one that isn't a
    // back-to-back repeat — the variety rule relaxes before the budget does,
    // which a small library needs (three recipes in a strict rotation leave no
    // choice at all). If every recipe is recent, cycle on.
    const allowance = remaining / (total - i);
    const cursor = cursorBySlot.get(cell.slot) ?? 0;
    const at = (k: number) => pool[(cursor + k) % pool.length] as LibraryRecipe;
    let chosen = -1;
    for (let k = 0; k < pool.length; k++) {
      const cand = at(k);
      if (!recent.includes(cand.id) && costOf(cand.id, cell.slot) <= allowance) {
        chosen = k;
        break;
      }
    }
    if (chosen < 0 && p.budget) {
      const backToBack = recent.slice(-p.slots.length);
      for (let k = 0; k < pool.length; k++) {
        if (backToBack.includes(at(k).id)) continue;
        if (chosen < 0 || costOf(at(k).id, cell.slot) < costOf(at(chosen).id, cell.slot)) chosen = k;
      }
    }

    let pick: LibraryRecipe;
    if (chosen < 0) {
      pick = pool[cursor % pool.length] as LibraryRecipe;
      cursorBySlot.set(cell.slot, (cursor + 1) % pool.length);
    } else {
      pick = pool[(cursor + chosen) % pool.length] as LibraryRecipe;
      cursorBySlot.set(cell.slot, (cursor + chosen + 1) % pool.length);
    }
    remaining -= costOf(pick.id, cell.slot);
    out.push({ date: cell.date, slot: cell.slot, source: 'library', recipeId: pick.id });
    recent.push(pick.id);
    while (recent.length > window) recent.shift();
  }

  return out;
}

/** A meal's cost for budgeting, and whether it's a stand-in for an unpriced one. */
export interface MealCost {
  cents: number;
  estimated: boolean;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : Math.round(((s[mid - 1] as number) + (s[mid] as number)) / 2);
}

/**
 * How to cost a proposed meal. A priced library recipe costs what it costs. An
 * unpriced one, or a fresh AI idea (no ingredients priced yet), stands in at the
 * median priced recipe for that slot — else across the library — so it neither
 * looks free (and wins every swap) nor blows the budget. Null when nothing in
 * the library is priced: there's no basis for a budget.
 */
export function mealCostModel(
  library: LibraryRecipe[],
  costById: Map<string, number | null>,
): ((recipeId: string | undefined, slot: Slot) => MealCost) | null {
  const priced = (rs: LibraryRecipe[]) =>
    rs.map((r) => costById.get(r.id)).filter((c): c is number => c != null);
  const overall = median(priced(library));
  if (overall == null) return null;

  const bySlot = new Map<Slot, number>();
  for (const slot of Object.keys(SLOT_MEAL_TYPES) as Slot[]) {
    bySlot.set(slot, median(priced(library.filter((r) => eligibleFor(r, slot)))) ?? overall);
  }

  return (recipeId, slot) => {
    const known = recipeId ? costById.get(recipeId) : null;
    if (known != null) return { cents: known, estimated: false };
    return { cents: bySlot.get(slot) ?? overall, estimated: true };
  };
}
