import { describe, expect, it } from 'vitest';

import type { PriceInfo } from '@/features/pricing/price-item';
import { rollupSpend, type OpenCheckedItem } from '@/features/pricing/spend';

const prices = new Map<string, PriceInfo>([
  ['milk', { priceCents: 399, packageQuantity: 1, packageUnit: 'gal' }],
]);

/** Local-time ISO, so month attribution doesn't depend on the test runner's TZ. */
function localISO(y: number, m: number, d: number, h = 12): string {
  return new Date(y, m - 1, d, h).toISOString();
}

function item(overrides: Partial<OpenCheckedItem>): OpenCheckedItem {
  return {
    canonicalId: 'milk',
    quantity: 1,
    unit: 'gal',
    actualCostCents: null,
    checkedAt: localISO(2026, 10, 5),
    category: null,
    ...overrides,
  };
}

describe('rollupSpend', () => {
  it('sums trips by purchase month', () => {
    const r = rollupSpend(
      [
        { purchasedOn: '2026-09-30', totalCents: 5000 },
        { purchasedOn: '2026-10-01', totalCents: 1200 },
        { purchasedOn: '2026-10-20', totalCents: 800 },
      ],
      [],
      prices,
      new Map(),
    );
    expect(r.byMonth.get('2026-09')).toBe(5000);
    expect(r.byMonth.get('2026-10')).toBe(2000);
  });

  it('prices open items at the purchase estimate, by the month they were checked', () => {
    const r = rollupSpend(
      [],
      [
        item({ checkedAt: localISO(2026, 10, 31, 23) }),
        item({ checkedAt: localISO(2026, 11, 1, 0) }),
      ],
      prices,
      new Map(),
    );
    expect(r.byMonth.get('2026-10')).toBe(399);
    expect(r.byMonth.get('2026-11')).toBe(399);
  });

  it('prefers a recorded actual price over the estimate', () => {
    const r = rollupSpend([], [item({ actualCostCents: 450 })], prices, new Map());
    expect(r.byMonth.get('2026-10')).toBe(450);
  });

  it('counts unpriceable open items without adding spend', () => {
    const r = rollupSpend(
      [],
      [item({ canonicalId: null }), item({ canonicalId: 'eggs' }), item({ unit: 'lb' })],
      prices,
      new Map(),
    );
    expect(r.byMonth.size).toBe(0);
    expect(r.unpricedCount).toBe(3);
    expect(r.openCount).toBe(3);
  });

  it('adds open items on top of trips in the same month', () => {
    const r = rollupSpend(
      [{ purchasedOn: '2026-10-02', totalCents: 1000 }],
      [item({ actualCostCents: 250 })],
      prices,
      new Map(),
    );
    expect(r.byMonth.get('2026-10')).toBe(1250);
  });
});
