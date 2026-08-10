import { describe, expect, it } from 'vitest';

import { parse } from '@/lib/ingredients/parse';

describe('parse — quantities', () => {
  it('parses a simple quantity + unit + name', () => {
    const p = parse('2 cups all-purpose flour');
    expect(p).toMatchObject({ quantity: 2, unit: 'cup', name: 'all-purpose flour' });
  });

  it('parses a simple fraction', () => {
    expect(parse('1/2 tsp kosher salt')).toMatchObject({ quantity: 0.5, unit: 'tsp' });
  });

  it('parses a mixed number', () => {
    expect(parse('1 1/2 cups sugar')).toMatchObject({ quantity: 1.5, unit: 'cup' });
  });

  it('parses a unicode fraction', () => {
    expect(parse('¼ cup olive oil')).toMatchObject({ quantity: 0.25, unit: 'cup' });
  });

  it('parses a unicode mixed number', () => {
    expect(parse('1½ cups milk')).toMatchObject({ quantity: 1.5, unit: 'cup' });
  });

  it('takes the upper bound of a range', () => {
    expect(parse('2-3 cloves garlic, minced')).toMatchObject({
      quantity: 3,
      unit: 'clove',
      name: 'garlic',
      descriptor: 'minced',
    });
  });

  it('treats "a"/"an" as 1', () => {
    expect(parse('a pinch of salt')).toMatchObject({ quantity: 1, unit: 'pinch', name: 'salt' });
  });

  it('defaults a unitless count to each', () => {
    expect(parse('3 large eggs')).toMatchObject({ quantity: 3, unit: 'each' });
  });
});

describe('parse — parentheticals', () => {
  it('multiplies a container package size out', () => {
    expect(parse('1 (8 oz) package cream cheese, softened')).toMatchObject({
      quantity: 8,
      unit: 'oz',
      name: 'cream cheese',
      descriptor: 'softened',
    });
  });

  it('multiplies count × can size', () => {
    expect(parse('2 (14.5 oz) cans diced tomatoes')).toMatchObject({
      quantity: 29,
      unit: 'oz',
      // "diced" is a leading product word here, not a trailing prep note.
      name: 'diced tomatoes',
    });
  });

  it('handles a parenthetical after the unit', () => {
    expect(parse('1 package (16 oz) frozen peas')).toMatchObject({
      quantity: 16,
      unit: 'oz',
      name: 'frozen peas',
    });
  });

  it('recognizes box as a container and multiplies its size', () => {
    expect(parse('1 (1 lb) box spaghetti')).toMatchObject({
      quantity: 1,
      unit: 'lb',
      name: 'spaghetti',
    });
  });

  it('ignores a non-measure parenthetical ("about 3")', () => {
    expect(parse('1 lb boneless skinless chicken breasts (about 3)')).toMatchObject({
      quantity: 1,
      unit: 'lb',
      name: 'boneless skinless chicken breasts',
    });
  });
});

describe('parse — compounds and vague', () => {
  it('folds a "+" compound into one quantity', () => {
    // 1/4 cup + 2 tbsp = 0.375 cup
    const p = parse('¼ cup + 2 tbsp olive oil');
    expect(p.unit).toBe('cup');
    expect(p.quantity).toBeCloseTo(0.375, 5);
    expect(p.name).toBe('olive oil');
  });

  it('marks "to taste" as a no-quantity vague line', () => {
    const p = parse('salt and pepper to taste');
    expect(p.quantity).toBeNull();
    expect(p.unit).toBe('to_taste');
    expect(p.name).toContain('salt and pepper');
  });

  it('flags optional ingredients', () => {
    expect(parse('1/4 cup chopped walnuts (optional)')).toMatchObject({
      isOptional: true,
      unit: 'cup',
      quantity: 0.25,
    });
  });
});

describe('parse — substitutions (X or Y)', () => {
  it('matches the first option and keeps the full text in raw', () => {
    const p = parse('2 tablespoons molasses or dark honey');
    expect(p).toMatchObject({ quantity: 2, unit: 'tbsp', name: 'molasses' });
    expect(p.raw).toBe('2 tablespoons molasses or dark honey');
  });

  it('handles multi-word options', () => {
    expect(parse('1/2 cup white vinegar or apple cider vinegar').name).toBe('white vinegar');
  });

  it('leaves plain lines (and non-substitution "and") untouched', () => {
    expect(parse('2 cups ketchup').name).toBe('ketchup');
    expect(parse('salt and pepper to taste').name).toContain('salt and pepper');
  });
});
