import { describe, expect, it } from 'vitest';

import { formatCurrency } from '@/lib/utils/format-currency';

// Smoke test for Slice 0. Money is integer cents everywhere; this is the one
// place it becomes a string, so it earns a test even at foundation stage.
describe('formatCurrency', () => {
  it('formats integer cents as USD', () => {
    expect(formatCurrency(1299)).toBe('$12.99');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('respects a different currency', () => {
    expect(formatCurrency(500, { currency: 'EUR', locale: 'en-IE' })).toBe('€5.00');
  });
});
