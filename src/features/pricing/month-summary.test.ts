import { describe, expect, it } from 'vitest';

import { summarizeMonth, UNITEMIZED } from '@/features/pricing/month-summary';

describe('summarizeMonth', () => {
  it('splits a trip across its line categories, remainder not itemized', () => {
    const s = summarizeMonth(
      [
        {
          totalCents: 2000,
          isEstimated: false,
          lines: [
            { category: 'produce', priceCents: 500 },
            { category: 'dairy', priceCents: 900 },
            { category: 'produce', priceCents: 300 },
            { category: 'dairy', priceCents: null },
          ],
        },
      ],
      [],
    );
    expect(s.totalCents).toBe(2000);
    expect(s.byCategory).toEqual([
      { category: 'dairy', cents: 900 },
      { category: 'produce', cents: 800 },
      { category: UNITEMIZED, cents: 300 },
    ]);
    expect(s.estimatedCents).toBe(0);
  });

  it('scales lines that exceed the trip total down to it, exactly', () => {
    const s = summarizeMonth(
      [
        {
          totalCents: 1000,
          isEstimated: false,
          lines: [
            { category: 'a', priceCents: 700 },
            { category: 'b', priceCents: 400 },
            { category: 'c', priceCents: 100 },
          ],
        },
      ],
      [],
    );
    const sum = s.byCategory.reduce((t, r) => t + r.cents, 0);
    expect(sum).toBe(1000);
    expect(s.byCategory.find((r) => r.category === UNITEMIZED)).toBeUndefined();
    expect(s.byCategory[0]).toMatchObject({ category: 'a' });
  });

  it('puts a total-only trip entirely under not itemized', () => {
    const s = summarizeMonth([{ totalCents: 742, isEstimated: false, lines: [] }], []);
    expect(s.byCategory).toEqual([{ category: UNITEMIZED, cents: 742 }]);
  });

  it('adds open items and tracks what is estimated', () => {
    const s = summarizeMonth(
      [{ totalCents: 1000, isEstimated: true, lines: [{ category: 'meat', priceCents: 1000 }] }],
      [
        { category: 'meat', cents: 250, isRecorded: true },
        { category: 'bakery', cents: 300, isRecorded: false },
        { category: 'bakery', cents: null, isRecorded: false },
      ],
    );
    expect(s.totalCents).toBe(1550);
    expect(s.estimatedCents).toBe(1300);
    expect(s.byCategory).toEqual([
      { category: 'meat', cents: 1250 },
      { category: 'bakery', cents: 300 },
    ]);
  });

  it('keeps not itemized last even when it is the largest', () => {
    const s = summarizeMonth(
      [{ totalCents: 5000, isEstimated: false, lines: [{ category: 'snacks', priceCents: 100 }] }],
      [],
    );
    expect(s.byCategory.map((r) => r.category)).toEqual(['snacks', UNITEMIZED]);
  });
});
