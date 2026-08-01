import { describe, expect, it } from 'vitest';

import { consolidate } from '@/lib/ingredients/consolidate';
import type { CanonicalInfo, ConsolidationInput } from '@/lib/ingredients/types';

const CREAM_CHEESE: CanonicalInfo = {
  id: 'cream-cheese',
  name: 'cream cheese',
  category: 'dairy',
  defaultUnit: 'oz',
  unitSize: { quantity: 8, unit: 'oz' },
};

const FLOUR: CanonicalInfo = {
  id: 'flour',
  name: 'all-purpose flour',
  category: 'pantry',
  defaultUnit: 'g',
  densityGPerMl: 0.53,
};

function lookup(map: Record<string, CanonicalInfo>) {
  return (id: string) => map[id];
}

describe('consolidate — the headline case', () => {
  it('merges 8 oz + 4 oz cream cheese into 12 oz, rounded to 2 × 8 oz', () => {
    const inputs: ConsolidationInput[] = [
      { canonicalId: 'cream-cheese', quantity: 8, unit: 'oz', ref: 'a' },
      { canonicalId: 'cream-cheese', quantity: 4, unit: 'oz', ref: 'b' },
    ];
    const [item] = consolidate(inputs, lookup({ 'cream-cheese': CREAM_CHEESE }));
    expect(item).toMatchObject({
      name: 'cream cheese',
      totalQuantity: 12,
      unit: 'oz',
      unresolved: false,
    });
    expect(item?.purchase).toEqual({
      packages: 2,
      packageQuantity: 8,
      packageUnit: 'oz',
      totalPurchaseQuantity: 16,
    });
    expect(item?.contributions).toHaveLength(2);
  });
});

describe('consolidate — units and scaling', () => {
  it('sums 1 cup + 2 tbsp into 1.125 cup', () => {
    const inputs: ConsolidationInput[] = [
      { canonicalId: 'x', quantity: 1, unit: 'cup' },
      { canonicalId: 'x', quantity: 2, unit: 'tbsp' },
    ];
    const [item] = consolidate(inputs);
    expect(item?.unit).toBe('cup');
    expect(item?.totalQuantity).toBeCloseTo(1.125, 4);
  });

  it('applies a servings scale factor', () => {
    const inputs: ConsolidationInput[] = [
      { canonicalId: 'x', quantity: 2, unit: 'cup', scale: 1.5 },
    ];
    const [item] = consolidate(inputs);
    expect(item?.totalQuantity).toBe(3);
  });

  it('merges volume + mass when density is known', () => {
    // 1 cup flour ≈ 236.588 ml × 0.53 ≈ 125.39 g, + 100 g = 225.39 g
    const inputs: ConsolidationInput[] = [
      { canonicalId: 'flour', quantity: 1, unit: 'cup' },
      { canonicalId: 'flour', quantity: 100, unit: 'g' },
    ];
    const [item] = consolidate(inputs, lookup({ flour: FLOUR }));
    expect(item?.unit).toBe('g');
    expect(item?.totalQuantity).toBeCloseTo(225.39, 1);
    expect(item?.unresolved).toBe(false);
  });
});

describe('consolidate — unresolved paths (must NOT silently merge)', () => {
  it('keeps volume + mass separate when density is unknown', () => {
    const inputs: ConsolidationInput[] = [
      { canonicalId: 'mystery', quantity: 12, unit: 'oz' },
      { canonicalId: 'mystery', quantity: 1, unit: 'cup' },
    ];
    const [item] = consolidate(inputs);
    expect(item?.unresolved).toBe(true);
    expect(item?.totalQuantity).toBeNull();
    expect(item?.subTotals).toEqual(
      expect.arrayContaining([
        { unit: 'oz', quantity: 12 },
        { unit: 'cup', quantity: 1 },
      ]),
    );
  });

  it('keeps different count units separate without count_to_gram', () => {
    const inputs: ConsolidationInput[] = [
      { canonicalId: 'garlic', quantity: 3, unit: 'clove' },
      { canonicalId: 'garlic', quantity: 1, unit: 'head' },
    ];
    const [item] = consolidate(inputs);
    expect(item?.unresolved).toBe(true);
  });
});

describe('consolidate — no-quantity reminders', () => {
  it('collects to-taste lines without doing math', () => {
    const inputs: ConsolidationInput[] = [
      { canonicalId: 'salt', quantity: null, unit: 'to_taste' },
      { canonicalId: 'salt', quantity: 1, unit: 'tsp' },
    ];
    const [item] = consolidate(inputs);
    expect(item?.totalQuantity).toBe(1);
    expect(item?.unit).toBe('tsp');
    expect(item?.noQuantityCount).toBe(1);
  });

  it('an item that is only to-taste has a null total', () => {
    const [item] = consolidate([{ canonicalId: 'pepper', quantity: null, unit: 'to_taste' }]);
    expect(item?.totalQuantity).toBeNull();
    expect(item?.noQuantityCount).toBe(1);
  });
});

describe('roundToPurchase via consolidate', () => {
  it('rounds 1.375 lb up to 1.5 lb when sold in 0.5 lb increments', () => {
    const beef: CanonicalInfo = {
      id: 'beef',
      name: 'ground beef',
      defaultUnit: 'lb',
      unitSize: { quantity: 0.5, unit: 'lb' },
    };
    const [item] = consolidate(
      [{ canonicalId: 'beef', quantity: 1.375, unit: 'lb' }],
      lookup({ beef }),
    );
    expect(item?.purchase?.totalPurchaseQuantity).toBe(1.5);
    expect(item?.purchase?.packages).toBe(3);
  });
});
