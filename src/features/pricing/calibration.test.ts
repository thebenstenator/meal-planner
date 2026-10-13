import { describe, expect, it } from 'vitest';

import { computeCalibration, type CalibrationPair } from '@/features/pricing/calibration';

/** A store price that's `ratio` × a $1.00/lb reference, in the same unit. */
function pair(ratio: number): CalibrationPair {
  return {
    store: { priceCents: Math.round(100 * ratio), packageQuantity: 1, packageUnit: 'lb' },
    reference: { priceCents: 100, packageQuantity: 1, packageUnit: 'lb' },
    info: {},
  };
}

describe('computeCalibration', () => {
  it('stays at the reference until there are enough real prices', () => {
    expect(computeCalibration([pair(1.3), pair(1.3), pair(1.3), pair(1.3)])).toEqual({
      factor: 1,
      basis: 0,
    });
  });

  it('learns the median ratio, ignoring outliers', () => {
    const c = computeCalibration([pair(1.1), pair(1.2), pair(1.2), pair(1.25), pair(3.0)]);
    expect(c.factor).toBeCloseTo(1.2);
    expect(c.basis).toBe(5);
  });

  it('compares unit prices across package sizes and units', () => {
    // $4.54 for 1 kg vs a $1.00/lb reference: 454 cents/kg ÷ (100 / 0.4536 kg) ≈ 2.06.
    const kg: CalibrationPair = {
      store: { priceCents: 454, packageQuantity: 1, packageUnit: 'kg' },
      reference: { priceCents: 100, packageQuantity: 1, packageUnit: 'lb' },
      info: {},
    };
    const c = computeCalibration([kg, kg, kg, kg, kg]);
    expect(c.factor).toBeCloseTo(1.6); // clamped from ~2.06
  });

  it('clamps to the bounds', () => {
    const cheap = computeCalibration(Array.from({ length: 5 }, () => pair(0.2)));
    expect(cheap.factor).toBe(0.6);
  });

  it('skips pairs it can’t compare', () => {
    const unconvertible: CalibrationPair = {
      store: { priceCents: 300, packageQuantity: 1, packageUnit: 'each' },
      reference: { priceCents: 100, packageQuantity: 1, packageUnit: 'lb' },
      info: {}, // no count_to_gram
    };
    expect(computeCalibration([unconvertible, pair(1.2), pair(1.2), pair(1.2), pair(1.2)])).toEqual({
      factor: 1,
      basis: 0,
    });
  });
});
