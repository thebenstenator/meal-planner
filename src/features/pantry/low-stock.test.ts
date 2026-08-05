import { describe, expect, it } from 'vitest';

import { isLowStock } from '@/features/pantry/low-stock';

describe('isLowStock', () => {
  it('is low when out of stock', () => {
    expect(isLowStock({ quantity: 0, unit: 'oz', packageQuantity: 8, packageUnit: 'oz' })).toBe(true);
  });

  it('is low below ~10% of a package', () => {
    // 0.5 oz of an 8 oz package = 6.25% < 10%
    expect(isLowStock({ quantity: 0.5, unit: 'oz', packageQuantity: 8, packageUnit: 'oz' })).toBe(true);
  });

  it('is not low when comfortably stocked', () => {
    expect(isLowStock({ quantity: 4, unit: 'oz', packageQuantity: 8, packageUnit: 'oz' })).toBe(false);
  });

  it('converts units before comparing', () => {
    // 10 g of a 454 g (1 lb) package, expressed in oz: 10 g ≈ 0.35 oz vs pkg 16 oz -> ~2% -> low
    expect(
      isLowStock({ quantity: 10, unit: 'g', packageQuantity: 16, packageUnit: 'oz', densityGPerMl: null }),
    ).toBe(true);
  });

  it('only flags at zero when there is no package size', () => {
    expect(isLowStock({ quantity: 1, unit: 'oz', packageQuantity: null, packageUnit: null })).toBe(false);
    expect(isLowStock({ quantity: 0, unit: 'oz', packageQuantity: null, packageUnit: null })).toBe(true);
  });

  it('does not flag as low when units cannot be reconciled', () => {
    // cup -> g needs a density; none provided, and quantity > 0
    expect(isLowStock({ quantity: 1, unit: 'cup', packageQuantity: 500, packageUnit: 'g' })).toBe(false);
  });
});
