import { describe, expect, it } from 'vitest';

import {
  aiTargetForDays,
  buildMonthPlan,
  libraryScore,
  mealCostModel,
  type Assignment,
  type LibraryRecipe,
} from '@/features/planner/autofill';
import type { Slot } from '@/schemas/plan';

const today = '2026-08-30';

function lib(n: number): LibraryRecipe[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    title: `Recipe ${i}`,
    isFavorite: false,
    timesCooked: 0,
    lastCookedOn: null,
    mealTypes: ['main' as const],
  }));
}

const days7 = Array.from({ length: 7 }, (_, i) => `2026-09-0${i + 1}`);

describe('libraryScore', () => {
  it('boosts favorites and staleness', () => {
    const fav: LibraryRecipe = { id: 'a', title: 'A', isFavorite: true, timesCooked: 3, lastCookedOn: '2026-08-29', mealTypes: ['main'] };
    const stale: LibraryRecipe = { id: 'b', title: 'B', isFavorite: false, timesCooked: 0, lastCookedOn: null, mealTypes: ['main'] };
    const fresh: LibraryRecipe = { id: 'c', title: 'C', isFavorite: false, timesCooked: 0, lastCookedOn: '2026-08-29', mealTypes: ['main'] };
    expect(libraryScore(fav, today)).toBeGreaterThan(libraryScore(stale, today));
    expect(libraryScore(stale, today)).toBeGreaterThan(libraryScore(fresh, today));
  });
});

describe('aiTargetForDays', () => {
  it('maps novelty levels to per-week counts', () => {
    expect(aiTargetForDays(28, 'all-favorites')).toBe(0);
    expect(aiTargetForDays(28, 'few-new')).toBe(4); // ~1/week
    expect(aiTargetForDays(28, 'many-new')).toBe(10); // ~2.5/week
  });
});

describe('buildMonthPlan', () => {
  it('all-favorites places only library recipes', () => {
    const plan = buildMonthPlan({ days: days7, slots: ['dinner'], library: lib(5), aiIdeaCount: 5, novelty: 'all-favorites', today });
    expect(plan).toHaveLength(7);
    expect(plan.every((a) => a.source === 'library')).toBe(true);
  });

  it('favorites are ranked first', () => {
    const library: LibraryRecipe[] = [
      { id: 'plain', title: 'Plain', isFavorite: false, timesCooked: 0, lastCookedOn: '2026-08-29', mealTypes: ['main'] },
      { id: 'fav', title: 'Fav', isFavorite: true, timesCooked: 0, lastCookedOn: '2026-08-29', mealTypes: ['main'] },
    ];
    const plan = buildMonthPlan({ days: ['2026-09-01'], slots: ['dinner'], library, aiIdeaCount: 0, novelty: 'all-favorites', today });
    expect(plan[0]?.recipeId).toBe('fav');
  });

  it('few-new mixes in ~1 AI idea per week and spreads it', () => {
    const plan = buildMonthPlan({ days: days7, slots: ['dinner'], library: lib(5), aiIdeaCount: 3, novelty: 'few-new', today });
    const ai = plan.filter((a) => a.source === 'ai');
    expect(ai).toHaveLength(1);
    expect(ai[0]?.aiIndex).toBe(0);
  });

  it('caps AI at the number of ideas available', () => {
    const plan = buildMonthPlan({ days: days7, slots: ['dinner'], library: lib(3), aiIdeaCount: 1, novelty: 'many-new', today });
    expect(plan.filter((a) => a.source === 'ai')).toHaveLength(1);
  });

  it('avoids the same recipe on adjacent days when it can', () => {
    const plan = buildMonthPlan({ days: days7, slots: ['dinner'], library: lib(4), aiIdeaCount: 0, novelty: 'all-favorites', today });
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i]?.recipeId).not.toBe(plan[i - 1]?.recipeId);
    }
  });

  it('fills dinner-only vs all slots correctly', () => {
    // A library that can cover every slot: mains for lunch/dinner, breakfast
    // dishes for breakfast — otherwise the breakfast cells would stay empty.
    const mixed: LibraryRecipe[] = [
      ...lib(5),
      { id: 'b1', title: 'Pancakes', isFavorite: false, timesCooked: 0, lastCookedOn: null, mealTypes: ['breakfast'] },
      { id: 'b2', title: 'Waffles', isFavorite: false, timesCooked: 0, lastCookedOn: null, mealTypes: ['breakfast'] },
    ];
    const dinnerOnly = buildMonthPlan({ days: days7, slots: ['dinner'], library: mixed, aiIdeaCount: 0, novelty: 'all-favorites', today });
    expect(dinnerOnly).toHaveLength(7);
    const allSlots = buildMonthPlan({ days: days7, slots: ['breakfast', 'lunch', 'dinner'], library: mixed, aiIdeaCount: 0, novelty: 'all-favorites', today });
    expect(allSlots).toHaveLength(21);
  });

  it('fills dinner only from mains, never a sauce or dessert', () => {
    const library: LibraryRecipe[] = [
      { id: 'main1', title: 'Bulgogi', isFavorite: false, timesCooked: 0, lastCookedOn: null, mealTypes: ['main'] },
      { id: 'main2', title: 'Orange Chicken', isFavorite: false, timesCooked: 0, lastCookedOn: null, mealTypes: ['main'] },
      { id: 'sauce', title: 'Gochujang Sauce', isFavorite: true, timesCooked: 9, lastCookedOn: null, mealTypes: ['sauce'] },
      { id: 'sweet', title: 'Eggnog Cheesecake', isFavorite: true, timesCooked: 9, lastCookedOn: null, mealTypes: ['dessert'] },
    ];
    const plan = buildMonthPlan({ days: days7, slots: ['dinner'], library, aiIdeaCount: 0, novelty: 'all-favorites', today });
    const ids = new Set(plan.map((a) => a.recipeId));
    // Sauce and dessert are favorited + most-cooked (top of the ranking), so if
    // they show up it's because the slot filter let them through.
    expect(ids.has('sauce')).toBe(false);
    expect(ids.has('sweet')).toBe(false);
    expect(plan.every((a) => a.recipeId === 'main1' || a.recipeId === 'main2')).toBe(true);
  });

  it('leaves a slot empty when nothing is eligible and no AI is left', () => {
    const library: LibraryRecipe[] = [
      { id: 'sauce', title: 'Buffalo Sauce', isFavorite: false, timesCooked: 0, lastCookedOn: null, mealTypes: ['sauce'] },
    ];
    const plan = buildMonthPlan({ days: days7, slots: ['dinner'], library, aiIdeaCount: 0, novelty: 'all-favorites', today });
    expect(plan).toHaveLength(0);
  });

  it('with no library, fills from AI ideas only', () => {
    const plan = buildMonthPlan({ days: days7, slots: ['dinner'], library: [], aiIdeaCount: 7, novelty: 'many-new', today });
    expect(plan.every((a) => a.source === 'ai')).toBe(true);
    expect(plan.length).toBe(7);
  });
});

describe('mealCostModel', () => {
  it('stands unpriced recipes and AI ideas in at the slot median', () => {
    const library = lib(4);
    const costs = new Map<string, number | null>([
      ['r0', 1000],
      ['r1', 2000],
      ['r2', 600],
      ['r3', null],
    ]);
    const cost = mealCostModel(library, costs)!;
    expect(cost('r1', 'dinner')).toEqual({ cents: 2000, estimated: false });
    expect(cost('r3', 'dinner')).toEqual({ cents: 1000, estimated: true });
    expect(cost(undefined, 'dinner')).toEqual({ cents: 1000, estimated: true });
  });

  it('has no basis for a budget when nothing is priced', () => {
    expect(mealCostModel(lib(3), new Map())).toBeNull();
  });
});

describe('buildMonthPlan with a budget', () => {
  // r0 is the favorite and the priciest; r1–r2 are cheap. Three recipes rotate,
  // so every r0 sits between the other two — the case cell-by-cell swapping
  // couldn't fix without a back-to-back repeat.
  const library: LibraryRecipe[] = lib(3).map((r, i) => (i === 0 ? { ...r, isFavorite: true } : r));
  const costs = new Map<string, number | null>([
    ['r0', 3000],
    ['r1', 500],
    ['r2', 600],
  ]);
  const cost = mealCostModel(library, costs)!;
  const days14 = Array.from({ length: 14 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
  const base = {
    days: days14,
    slots: ['dinner'] as Slot[],
    library,
    aiIdeaCount: 0,
    novelty: 'all-favorites' as const,
    today,
  };
  const totalOf = (as: Assignment[]) => as.reduce((s, a) => s + cost(a.recipeId, a.slot).cents, 0);
  const plain = buildMonthPlan(base);

  it('changes nothing when the budget is generous', () => {
    expect(buildMonthPlan({ ...base, budget: { cents: 1_000_000, cost } })).toEqual(plain);
  });

  it('fits the budget, keeping the favorite where the money allows', () => {
    const budget = 14 * 1000; // ~$10/night against a $30 favorite
    const plan = buildMonthPlan({ ...base, budget: { cents: budget, cost } });
    expect(totalOf(plan)).toBeLessThanOrEqual(budget);
    expect(totalOf(plan)).toBeLessThan(totalOf(plain));
    const favorites = plan.filter((a) => a.recipeId === 'r0').length;
    expect(favorites).toBeGreaterThan(0);
    expect(favorites).toBeLessThan(plain.filter((a) => a.recipeId === 'r0').length);
  });

  it('goes as cheap as variety allows when the budget is out of reach', () => {
    const plan = buildMonthPlan({ ...base, budget: { cents: 0, cost } });
    expect(plan.some((a) => a.recipeId === 'r0')).toBe(false);
    const ids = plan.map((a) => a.recipeId);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
  });

  it('spends no budget on occupied cells and never fills them', () => {
    const plan = buildMonthPlan({
      ...base,
      isOccupied: (date) => date === '2026-09-01',
      budget: { cents: 1_000_000, cost },
    });
    expect(plan.find((a) => a.date === '2026-09-01')).toBeUndefined();
    expect(plan).toHaveLength(13);
  });

  it('counts AI ideas at the stand-in cost and keeps their placement', () => {
    const withAi = { ...base, aiIdeaCount: 2, novelty: 'many-new' as const };
    const unbudgeted = buildMonthPlan(withAi);
    const budgeted = buildMonthPlan({ ...withAi, budget: { cents: 0, cost } });
    const aiCells = (as: Assignment[]) => as.filter((a) => a.source === 'ai');
    expect(aiCells(budgeted)).toEqual(aiCells(unbudgeted));
  });
});
