import { describe, expect, it } from 'vitest';

import type { PriceInfo } from '@/features/pricing/price-item';
import {
  consumptionCost,
  recipeCost,
  type CostableIngredient,
} from '@/features/pricing/recipe-cost';

const soySauce: PriceInfo = { priceCents: 300, packageQuantity: 15, packageUnit: 'oz' };

describe('consumptionCost', () => {
  it('charges only the portion used (2 oz of a $3.00 / 15 oz bottle)', () => {
    // 300/15 = 20 cents/oz × 2 oz = 40 cents
    expect(consumptionCost(2, 'oz', soySauce)).toBeCloseTo(40, 6);
  });

  it('does not round up to a whole package', () => {
    // 3 oz of an 8 oz / $2.50 block = 0.3125 × 250 = 93.75 cents (not 250)
    const block: PriceInfo = { priceCents: 250, packageQuantity: 8, packageUnit: 'oz' };
    expect(consumptionCost(3, 'oz', block)).toBeCloseTo(93.75, 6);
  });

  it('converts units via density before pricing', () => {
    // 1 cup water = 236.6 g; $1.00 / 100 g → 2.366 × 100 = 236.6 cents
    const price: PriceInfo = { priceCents: 100, packageQuantity: 100, packageUnit: 'g' };
    expect(consumptionCost(1, 'cup', price, { densityGPerMl: 1 })).toBeCloseTo(236.6, 1);
  });

  it('returns null when the unit cannot be converted', () => {
    const price: PriceInfo = { priceCents: 100, packageQuantity: 100, packageUnit: 'g' };
    expect(consumptionCost(1, 'cup', price)).toBeNull();
  });

  it('returns null for a no-quantity item', () => {
    expect(consumptionCost(null, null, soySauce)).toBeNull();
  });
});

describe('recipeCost', () => {
  const prices = new Map<string, PriceInfo>([
    ['soy', soySauce],
    ['cream', { priceCents: 250, packageQuantity: 8, packageUnit: 'oz' }],
  ]);
  const infos = new Map();

  it('sums priced ingredients and computes per-serving cost', () => {
    const ings: CostableIngredient[] = [
      { quantity: 2, unit: 'oz', canonicalId: 'soy' }, // 40
      { quantity: 8, unit: 'oz', canonicalId: 'cream' }, // 250
    ];
    const cost = recipeCost(ings, 4, prices, infos);
    expect(cost.totalCents).toBe(290);
    expect(cost.perServingCents).toBe(73); // round(290/4)
    expect(cost.pricedCount).toBe(2);
    expect(cost.unpricedCount).toBe(0);
  });

  it('counts unmatched/unpriced ingredients but still totals the rest', () => {
    const ings: CostableIngredient[] = [
      { quantity: 2, unit: 'oz', canonicalId: 'soy' }, // 40
      { quantity: 1, unit: 'each', canonicalId: null }, // unmatched
      { quantity: 1, unit: 'oz', canonicalId: 'unknown' }, // no price
    ];
    const cost = recipeCost(ings, 2, prices, infos);
    expect(cost.totalCents).toBe(40);
    expect(cost.pricedCount).toBe(1);
    expect(cost.unpricedCount).toBe(2);
  });

  it('skips optional ingredients without counting them as unpriced', () => {
    const ings: CostableIngredient[] = [
      { quantity: 2, unit: 'oz', canonicalId: 'soy' },
      { quantity: 1, unit: 'oz', canonicalId: 'unknown', isOptional: true },
    ];
    const cost = recipeCost(ings, 1, prices, infos);
    expect(cost.totalCents).toBe(40);
    expect(cost.unpricedCount).toBe(0);
  });

  it('clamps servings to at least 1', () => {
    const ings: CostableIngredient[] = [{ quantity: 2, unit: 'oz', canonicalId: 'soy' }];
    const cost = recipeCost(ings, 0, prices, infos);
    expect(cost.perServingCents).toBe(40);
  });
});
