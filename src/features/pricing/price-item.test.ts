import { describe, expect, it } from 'vitest';

import { estimateItemCost } from '@/features/pricing/price-item';

const creamCheese = { priceCents: 250, packageQuantity: 8, packageUnit: 'oz' };

describe('estimateItemCost', () => {
  it('rounds up to whole packages (12 oz needs 2 × 8 oz)', () => {
    // ceil(12/8) = 2 packages × $2.50 = $5.00
    expect(estimateItemCost(12, 'oz', creamCheese)).toBe(500);
  });

  it('charges a full package for less than one', () => {
    expect(estimateItemCost(3, 'oz', creamCheese)).toBe(250);
  });

  it('converts units via density before pricing', () => {
    // 1 cup water = 236.6 g; priced per 100 g -> ceil(2.366)=3 × $1 = $3
    const price = { priceCents: 100, packageQuantity: 100, packageUnit: 'g' };
    expect(estimateItemCost(1, 'cup', price, { densityGPerMl: 1 })).toBe(300);
  });

  it('returns null when the unit cannot be converted', () => {
    const price = { priceCents: 100, packageQuantity: 100, packageUnit: 'g' };
    // cup -> g needs density; none given
    expect(estimateItemCost(1, 'cup', price)).toBeNull();
  });

  it('returns null for a no-quantity item', () => {
    expect(estimateItemCost(null, null, creamCheese)).toBeNull();
  });
});
