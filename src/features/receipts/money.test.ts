import { describe, expect, it } from 'vitest';

import { centsToDollars, dollarsToCents } from '@/features/receipts/money';

describe('dollarsToCents', () => {
  it('parses plain dollars to integer cents', () => {
    expect(dollarsToCents('4.19')).toBe(419);
    expect(dollarsToCents('10')).toBe(1000);
    expect(dollarsToCents('0.99')).toBe(99);
  });

  it('strips $ and thousands commas', () => {
    expect(dollarsToCents('$1,299.00')).toBe(129900);
    expect(dollarsToCents(' $3.50 ')).toBe(350);
  });

  it('handles 2-decimal prices exactly despite float math', () => {
    // 4.19 * 100 is 418.99999… in IEEE-754; Math.round recovers 419.
    expect(dollarsToCents('4.19')).toBe(419);
    expect(dollarsToCents('19.99')).toBe(1999);
    expect(dollarsToCents('2.994')).toBe(299); // extra digits round to nearest cent
  });

  it('returns null for blank or garbage', () => {
    expect(dollarsToCents('')).toBeNull();
    expect(dollarsToCents('   ')).toBeNull();
    expect(dollarsToCents('abc')).toBeNull();
  });
});

describe('centsToDollars', () => {
  it('formats integer cents as a 2-decimal dollars string', () => {
    expect(centsToDollars(419)).toBe('4.19');
    expect(centsToDollars(1000)).toBe('10.00');
    expect(centsToDollars(0)).toBe('0.00');
  });

  it('returns empty string for null', () => {
    expect(centsToDollars(null)).toBe('');
  });

  it('round-trips with dollarsToCents', () => {
    for (const c of [1, 99, 419, 129900]) {
      expect(dollarsToCents(centsToDollars(c))).toBe(c);
    }
  });
});
