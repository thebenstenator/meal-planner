import { describe, expect, it } from 'vitest';

import {
  looseAmount,
  mergePurchasedPackage,
  reconcileToTotal,
  sealedTotal,
  type PackageLine,
} from '@/features/pantry/packages';

const enchilada: PackageLine[] = [
  { size: 32, unit: 'oz', count: 2 },
  { size: 16, unit: 'oz', count: 2 },
];

describe('sealedTotal', () => {
  it('sums size × count in the item unit', () => {
    expect(sealedTotal(enchilada, 'oz')).toBe(96);
  });

  it('converts lines in a different but compatible unit', () => {
    // 1 lb = 16 oz, added to a 16 oz line.
    const lines: PackageLine[] = [
      { size: 16, unit: 'oz', count: 1 },
      { size: 1, unit: 'lb', count: 1 },
    ];
    expect(sealedTotal(lines, 'oz')).toBeCloseTo(32, 5);
  });

  it('skips lines whose unit cannot be reconciled', () => {
    const lines: PackageLine[] = [
      { size: 16, unit: 'oz', count: 1 },
      { size: 2, unit: 'cup', count: 1 }, // volume, no density → not convertible to oz (mass)
    ];
    expect(sealedTotal(lines, 'oz')).toBe(16);
  });
});

describe('mergePurchasedPackage', () => {
  it('bumps a matching stack', () => {
    const out = mergePurchasedPackage(enchilada, { size: 32, unit: 'oz', count: 1 });
    expect(out.find((l) => l.size === 32)?.count).toBe(3);
    expect(out).toHaveLength(2);
  });

  it('appends a new size', () => {
    const out = mergePurchasedPackage(enchilada, { size: 8, unit: 'oz', count: 4 });
    expect(out).toHaveLength(3);
    expect(out.find((l) => l.size === 8)?.count).toBe(4);
  });
});

describe('reconcileToTotal', () => {
  it('leaves packages alone when the total still covers them', () => {
    expect(reconcileToTotal(enchilada, 96, 'oz')).toEqual(enchilada);
    expect(reconcileToTotal(enchilada, 200, 'oz')).toEqual(enchilada);
  });

  it('opens the smallest container first when stock drops', () => {
    // 96 → 88 after cooking 8 oz: one 16oz can opens, leaving 8 oz loose.
    const out = reconcileToTotal(enchilada, 88, 'oz');
    expect(out).toEqual([
      { size: 32, unit: 'oz', count: 2 },
      { size: 16, unit: 'oz', count: 1 },
    ]);
    expect(sealedTotal(out, 'oz')).toBe(80);
    expect(looseAmount(88, out, 'oz')).toBe(8);
  });

  it('opens multiple containers, smallest-first', () => {
    // Down to 50 oz: both 16s open, then one 32 opens (sealed 32 ≤ 50).
    const out = reconcileToTotal(enchilada, 50, 'oz');
    expect(out).toEqual([{ size: 32, unit: 'oz', count: 1 }]);
    expect(looseAmount(50, out, 'oz')).toBe(18);
  });

  it('empties out at zero', () => {
    expect(reconcileToTotal(enchilada, 0, 'oz')).toEqual([]);
  });

  it('does not open containers it cannot compare (bounded)', () => {
    const lines: PackageLine[] = [{ size: 2, unit: 'cup', count: 3 }];
    // itemUnit oz + volume line with no density → can't convert → left untouched.
    expect(reconcileToTotal(lines, 0, 'oz')).toEqual(lines);
  });
});
