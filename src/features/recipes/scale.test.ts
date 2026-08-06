import { describe, expect, it } from 'vitest';

import { scaledAmount } from '@/features/recipes/scale';

describe('scaledAmount', () => {
  it('doubles from 4 to 8 servings', () => {
    expect(scaledAmount(2, 'cups', 4, 8)).toBe('4 cups');
  });

  it('halves and keeps a clean fraction', () => {
    expect(scaledAmount(3, 'tbsp', 4, 2)).toBe('1.5 tbsp');
  });

  it('rounds to 2 decimals', () => {
    // 1 * (3/7) = 0.4285… -> 0.43
    expect(scaledAmount(1, 'cup', 7, 3)).toBe('0.43 cup');
  });

  it('handles no unit', () => {
    expect(scaledAmount(2, null, 4, 6)).toBe('3');
  });

  it('returns null for a no-quantity line', () => {
    expect(scaledAmount(null, 'pinch', 4, 8)).toBeNull();
  });

  it('is a no-op at the same servings', () => {
    expect(scaledAmount(2, 'cups', 4, 4)).toBe('2 cups');
  });
});
