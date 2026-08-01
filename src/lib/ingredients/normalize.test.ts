import { describe, expect, it } from 'vitest';

import { cleanName, resolveUnit } from '@/lib/ingredients/normalize';

describe('resolveUnit', () => {
  it('maps common abbreviations and plurals', () => {
    expect(resolveUnit('tablespoons')).toBe('tbsp');
    expect(resolveUnit('Tbs')).toBe('tbsp');
    expect(resolveUnit('tbsp.')).toBe('tbsp');
    expect(resolveUnit('c')).toBe('cup');
    expect(resolveUnit('lbs')).toBe('lb');
    expect(resolveUnit('fl oz')).toBe('floz');
    expect(resolveUnit('cloves')).toBe('clove');
  });

  it('distinguishes capital T (tbsp) from lowercase t (tsp)', () => {
    expect(resolveUnit('T')).toBe('tbsp');
    expect(resolveUnit('t')).toBe('tsp');
  });

  it('returns null for non-units', () => {
    expect(resolveUnit('flour')).toBeNull();
    expect(resolveUnit('')).toBeNull();
  });
});

describe('cleanName', () => {
  it('strips articles and lowercases', () => {
    expect(cleanName('An Onion')).toEqual({ name: 'onion', descriptor: null });
  });

  it('pulls a post-comma descriptor', () => {
    expect(cleanName('cream cheese, softened')).toEqual({
      name: 'cream cheese',
      descriptor: 'softened',
    });
  });

  it('peels trailing prep words into the descriptor', () => {
    expect(cleanName('garlic minced')).toEqual({
      name: 'garlic',
      descriptor: 'minced',
    });
    expect(cleanName('butter at room temperature')).toEqual({
      name: 'butter',
      descriptor: 'at room temperature',
    });
  });

  it('drops parentheticals from the name', () => {
    expect(cleanName('chicken breasts (about 3)').name).toBe('chicken breasts');
  });
});
