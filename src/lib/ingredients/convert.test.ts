import { describe, expect, it } from 'vitest';

import { canConvert, convert } from '@/lib/ingredients/convert';

describe('convert — same dimension', () => {
  it('mass: oz to oz identity and oz to lb', () => {
    expect(convert(8, 'oz', 'oz')).toEqual({ ok: true, quantity: 8 });
    const r = convert(16, 'oz', 'lb');
    expect(r.ok && r.quantity).toBeCloseTo(1, 5);
  });

  it('volume: cup to tbsp', () => {
    const r = convert(1, 'cup', 'tbsp');
    expect(r.ok && r.quantity).toBeCloseTo(16, 4);
  });

  it('8 oz + 4 oz stays in oz (via identity)', () => {
    const r = convert(4, 'oz', 'oz');
    expect(r.ok && r.quantity).toBe(4);
  });
});

describe('convert — volume↔mass with density', () => {
  it('converts cups of water to grams (density 1.0)', () => {
    const r = convert(1, 'cup', 'g', { densityGPerMl: 1.0 });
    expect(r.ok && r.quantity).toBeCloseTo(236.588, 2);
  });

  it('refuses volume↔mass without density', () => {
    const r = convert(1, 'cup', 'g');
    expect(r.ok).toBe(false);
  });
});

describe('convert — count↔mass with count_to_gram', () => {
  it('converts eggs to grams (50g each)', () => {
    const r = convert(3, 'each', 'g', { countToGram: 50 });
    expect(r.ok && r.quantity).toBeCloseTo(150, 5);
  });

  it('refuses count↔mass without count_to_gram', () => {
    expect(convert(3, 'each', 'g').ok).toBe(false);
  });

  it('refuses different count units (clove vs each)', () => {
    expect(convert(2, 'clove', 'each').ok).toBe(false);
  });
});

describe('convert — vague', () => {
  it('never converts vague units', () => {
    expect(convert(1, 'pinch', 'g').ok).toBe(false);
    expect(canConvert('to_taste', 'tsp')).toBe(false);
  });
});
