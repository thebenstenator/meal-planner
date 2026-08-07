import { describe, expect, it } from 'vitest';

import { aiTargetForDays, buildMonthPlan, libraryScore, type LibraryRecipe } from '@/features/planner/autofill';

const today = '2026-08-30';

function lib(n: number): LibraryRecipe[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    title: `Recipe ${i}`,
    isFavorite: false,
    timesCooked: 0,
    lastCookedOn: null,
  }));
}

const days7 = Array.from({ length: 7 }, (_, i) => `2026-09-0${i + 1}`);

describe('libraryScore', () => {
  it('boosts favorites and staleness', () => {
    const fav: LibraryRecipe = { id: 'a', title: 'A', isFavorite: true, timesCooked: 3, lastCookedOn: '2026-08-29' };
    const stale: LibraryRecipe = { id: 'b', title: 'B', isFavorite: false, timesCooked: 0, lastCookedOn: null };
    const fresh: LibraryRecipe = { id: 'c', title: 'C', isFavorite: false, timesCooked: 0, lastCookedOn: '2026-08-29' };
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
      { id: 'plain', title: 'Plain', isFavorite: false, timesCooked: 0, lastCookedOn: '2026-08-29' },
      { id: 'fav', title: 'Fav', isFavorite: true, timesCooked: 0, lastCookedOn: '2026-08-29' },
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
    const dinnerOnly = buildMonthPlan({ days: days7, slots: ['dinner'], library: lib(5), aiIdeaCount: 0, novelty: 'all-favorites', today });
    expect(dinnerOnly).toHaveLength(7);
    const allSlots = buildMonthPlan({ days: days7, slots: ['breakfast', 'lunch', 'dinner'], library: lib(5), aiIdeaCount: 0, novelty: 'all-favorites', today });
    expect(allSlots).toHaveLength(21);
  });

  it('with no library, fills from AI ideas only', () => {
    const plan = buildMonthPlan({ days: days7, slots: ['dinner'], library: [], aiIdeaCount: 7, novelty: 'many-new', today });
    expect(plan.every((a) => a.source === 'ai')).toBe(true);
    expect(plan.length).toBe(7);
  });
});
