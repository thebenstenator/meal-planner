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

function eligibleFor(recipe: LibraryRecipe, slot: Slot): boolean {
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
 */
export function buildMonthPlan(p: AutofillParams): Assignment[] {
  const cells: { date: string; slot: Slot }[] = [];
  for (const date of p.days) for (const slot of p.slots) cells.push({ date, slot });
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

  for (let i = 0; i < total; i++) {
    const cell = cells[i] as { date: string; slot: Slot };
    const pool = poolBySlot.get(cell.slot) ?? [];
    const wantAi = aiAt.has(i) && aiCursor < newTarget;

    if (wantAi || pool.length === 0) {
      if (aiCursor < p.aiIdeaCount) {
        out.push({ date: cell.date, slot: cell.slot, source: 'ai', aiIndex: aiCursor++ });
      }
      continue; // nothing eligible and no AI left -> leave the slot empty
    }

    // Next recipe in this slot's pool not used in the recent window (cycle if
    // all are recent).
    const cursor = cursorBySlot.get(cell.slot) ?? 0;
    let pick = pool[cursor % pool.length] as LibraryRecipe;
    for (let k = 0; k < pool.length; k++) {
      const cand = pool[(cursor + k) % pool.length] as LibraryRecipe;
      if (!recent.includes(cand.id)) {
        pick = cand;
        cursorBySlot.set(cell.slot, (cursor + k + 1) % pool.length);
        break;
      }
      if (k === pool.length - 1) cursorBySlot.set(cell.slot, (cursor + 1) % pool.length);
    }
    out.push({ date: cell.date, slot: cell.slot, source: 'library', recipeId: pick.id });
    recent.push(pick.id);
    while (recent.length > window) recent.shift();
  }

  return out;
}
