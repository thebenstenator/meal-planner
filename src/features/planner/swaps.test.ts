import { describe, expect, it } from 'vitest';

import type { PlanEntry } from '@/features/planner/api';
import type { LibraryRecipe } from '@/features/planner/autofill';
import { suggestSwaps, type ServingCost } from '@/features/planner/swaps';

const today = '2026-10-13';

function recipe(id: string, overrides: Partial<LibraryRecipe> = {}): LibraryRecipe {
  return {
    id,
    title: id,
    isFavorite: false,
    timesCooked: 0,
    lastCookedOn: null,
    mealTypes: ['main'],
    servings: 4,
    ...overrides,
  };
}

function meal(date: string, recipeId: string, overrides: Partial<PlanEntry> = {}): PlanEntry {
  return {
    id: `${date}-${recipeId}`,
    date,
    slot: 'dinner',
    kind: 'recipe',
    recipeId,
    recipeTitle: recipeId,
    note: null,
    servingsOverride: null,
    cookedAt: null,
    position: 0,
    costCents: null,
    ...overrides,
  };
}

// Per-serving costs; every recipe serves 4.
const costs: Record<string, ServingCost> = {
  salmon: { perServingCents: 500, unpriced: false },
  chicken: { perServingCents: 250, unpriced: false },
  beans: { perServingCents: 100, unpriced: false },
  pasta: { perServingCents: 450, unpriced: false },
  mystery: { perServingCents: 50, unpriced: true }, // partly priced
  cake: { perServingCents: 80, unpriced: false },
};
const costOf = (id: string) => costs[id];

const library = [
  recipe('salmon'),
  recipe('chicken', { isFavorite: true }),
  recipe('beans'),
  recipe('pasta'),
  recipe('mystery'),
  recipe('cake', { mealTypes: ['dessert'] }),
];

describe('suggestSwaps', () => {
  it('suggests the best-liked cheaper recipe and the saving at planned servings', () => {
    const [s] = suggestSwaps([meal('2026-10-15', 'salmon')], library, costOf, today);
    // Chicken is the favorite and cheaper: (500 − 250) × 4 servings.
    expect(s).toMatchObject({ toRecipeId: 'chicken', savingsCents: 1000 });
  });

  it('uses a servings override when the meal has one', () => {
    const [s] = suggestSwaps(
      [meal('2026-10-15', 'salmon', { servingsOverride: 2 })],
      library,
      costOf,
      today,
    );
    expect(s?.savingsCents).toBe(500);
  });

  it('skips savings too small to be worth it', () => {
    // 20¢ off a $5.00 serving: 80¢ across 4 servings, and 4% — under both bars.
    const tiny: Record<string, ServingCost> = {
      a: { perServingCents: 500, unpriced: false },
      b: { perServingCents: 480, unpriced: false },
    };
    const got = suggestSwaps(
      [meal('2026-10-15', 'a')],
      [recipe('a'), recipe('b')],
      (id) => tiny[id],
      today,
    );
    expect(got).toEqual([]);
  });

  it('never suggests a partly priced recipe, or one that doesn’t fit the slot', () => {
    const got = suggestSwaps([meal('2026-10-15', 'beans')], library, costOf, today);
    // Mystery is "cheaper" only because it's missing prices; cake is a dessert.
    expect(got).toEqual([]);
  });

  it('avoids creating a back-to-back repeat', () => {
    const [s] = suggestSwaps(
      [meal('2026-10-14', 'chicken'), meal('2026-10-15', 'salmon')],
      library,
      costOf,
      today,
    );
    expect(s).toMatchObject({ entryId: '2026-10-15-salmon', toRecipeId: 'beans' });
  });

  it('leaves past, cooked and unpriced meals alone', () => {
    const got = suggestSwaps(
      [
        meal('2026-10-12', 'salmon'),
        meal('2026-10-15', 'salmon', { cookedAt: '2026-10-13T12:00:00Z' }),
        meal('2026-10-16', 'mystery'),
      ],
      library,
      costOf,
      today,
    );
    expect(got).toEqual([]);
  });

  it('orders by saving and caps the list', () => {
    const got = suggestSwaps(
      [meal('2026-10-15', 'pasta'), meal('2026-10-17', 'salmon')],
      library,
      costOf,
      today,
      1,
    );
    expect(got).toHaveLength(1);
    expect(got[0]?.fromTitle).toBe('salmon');
  });
});
