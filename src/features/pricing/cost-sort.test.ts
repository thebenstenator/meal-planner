import { describe, expect, it } from 'vitest';

import { sortByCost, type SortableCost } from '@/features/pricing/cost-sort';

const recipes = [
  { id: 'a', title: 'Alpha' },
  { id: 'b', title: 'Bravo' },
  { id: 'c', title: 'Charlie' },
  { id: 'd', title: 'Delta' },
  { id: 'e', title: 'Echo' },
  { id: 'f', title: 'Foxtrot' },
];

const costs: Record<string, SortableCost> = {
  a: { cents: 450, unpriced: false },
  b: { cents: null, unpriced: true },
  c: { cents: 120, unpriced: true }, // partly priced: a floor
  d: { cents: 300, unpriced: false },
  e: { cents: 300, unpriced: false },
};

describe('sortByCost', () => {
  const titles = sortByCost(recipes, (id) => costs[id]).map((r) => r.title);

  it('puts fully priced recipes first, cheapest first', () => {
    expect(titles.slice(0, 3)).toEqual(['Delta', 'Echo', 'Alpha']);
  });

  it('ranks partly priced recipes after fully priced ones, however cheap they look', () => {
    expect(titles[3]).toBe('Charlie');
  });

  it('ends with unpriced and unknown recipes, A–Z', () => {
    expect(titles.slice(4)).toEqual(['Bravo', 'Foxtrot']);
  });

  it('does not mutate its input', () => {
    expect(recipes.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});
