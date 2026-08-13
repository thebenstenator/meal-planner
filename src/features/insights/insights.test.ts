import { describe, expect, it } from 'vitest';

import {
  expiringItems,
  staleRecipes,
  weekVariety,
  type ExpiringInput,
  type PlannedRecipe,
} from '@/features/insights/insights';
import type { LibraryRecipe } from '@/features/planner/autofill';

const today = '2026-08-30';

function recipe(over: Partial<LibraryRecipe> & { id: string }): LibraryRecipe {
  return { title: over.id, isFavorite: false, timesCooked: 0, lastCookedOn: null, mealTypes: [], ...over };
}

describe('staleRecipes', () => {
  it('excludes never-cooked recipes', () => {
    const lib = [recipe({ id: 'never', timesCooked: 0, lastCookedOn: null })];
    expect(staleRecipes(lib, today)).toHaveLength(0);
  });

  it('excludes recipes cooked recently', () => {
    const lib = [recipe({ id: 'fresh', timesCooked: 2, lastCookedOn: '2026-08-25' })]; // 5 days ago
    expect(staleRecipes(lib, today)).toHaveLength(0);
  });

  it('surfaces recipes cooked a while ago, stalest first', () => {
    const lib = [
      recipe({ id: 'old', timesCooked: 3, lastCookedOn: '2026-06-01' }),
      recipe({ id: 'medium', timesCooked: 1, lastCookedOn: '2026-07-25' }),
    ];
    const out = staleRecipes(lib, today);
    expect(out.map((r) => r.id)).toEqual(['old', 'medium']);
  });

  it('boosts favorites over equally-stale non-favorites', () => {
    const lib = [
      recipe({ id: 'plain', timesCooked: 1, lastCookedOn: '2026-07-01' }),
      recipe({ id: 'fav', isFavorite: true, timesCooked: 1, lastCookedOn: '2026-07-01' }),
    ];
    expect(staleRecipes(lib, today)[0]?.id).toBe('fav');
  });

  it('respects the limit', () => {
    const lib = Array.from({ length: 8 }, (_, i) =>
      recipe({ id: `r${i}`, timesCooked: 1, lastCookedOn: '2026-06-01' }),
    );
    expect(staleRecipes(lib, today, 3)).toHaveLength(3);
  });
});

describe('expiringItems', () => {
  const items: ExpiringInput[] = [
    { id: 'a', canonicalName: 'milk', expiresOn: '2026-09-01' }, // 2 days
    { id: 'b', canonicalName: 'yogurt', expiresOn: '2026-08-28' }, // expired 2 days ago
    { id: 'c', canonicalName: 'flour', expiresOn: '2026-10-01' }, // far off
    { id: 'd', canonicalName: 'salt', expiresOn: null },
  ];

  it('includes soon-to-expire and already-expired, soonest first', () => {
    const out = expiringItems(items, today, 5);
    expect(out.map((i) => i.canonicalName)).toEqual(['yogurt', 'milk']);
  });

  it('computes daysLeft (negative = expired)', () => {
    const out = expiringItems(items, today, 5);
    expect(out.find((i) => i.canonicalName === 'yogurt')?.daysLeft).toBe(-2);
    expect(out.find((i) => i.canonicalName === 'milk')?.daysLeft).toBe(2);
  });

  it('ignores items without an expiry and those beyond the window', () => {
    const out = expiringItems(items, today, 5);
    expect(out.map((i) => i.canonicalName)).not.toContain('flour');
    expect(out.map((i) => i.canonicalName)).not.toContain('salt');
  });
});

describe('weekVariety', () => {
  it('counts planned meals, distinct recipes, and repeats', () => {
    const entries: PlannedRecipe[] = [
      { recipeId: 'r1', recipeTitle: 'Tacos' },
      { recipeId: 'r1', recipeTitle: 'Tacos' },
      { recipeId: 'r1', recipeTitle: 'Tacos' },
      { recipeId: 'r2', recipeTitle: 'Soup' },
      { recipeId: null, recipeTitle: null }, // eating out / note
    ];
    const v = weekVariety(entries);
    expect(v.plannedRecipeMeals).toBe(4);
    expect(v.distinctRecipes).toBe(2);
    expect(v.repeats).toEqual([{ title: 'Tacos', count: 3 }]);
  });

  it('reports no repeats when every meal is distinct', () => {
    const entries: PlannedRecipe[] = [
      { recipeId: 'r1', recipeTitle: 'A' },
      { recipeId: 'r2', recipeTitle: 'B' },
    ];
    expect(weekVariety(entries).repeats).toEqual([]);
  });
});
