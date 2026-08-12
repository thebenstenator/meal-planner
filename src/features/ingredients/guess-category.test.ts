import { describe, expect, it } from 'vitest';

import { guessCategory } from '@/features/ingredients/guess-category';

describe('guessCategory', () => {
  it('classifies the high-value categories from a name', () => {
    expect(guessCategory('gummy bears')).toBe('snacks');
    expect(guessCategory('Doritos')).toBe('snacks');
    expect(guessCategory('Coca-Cola')).toBe('beverages');
    expect(guessCategory('orange juice')).toBe('beverages');
    expect(guessCategory('atlantic salmon')).toBe('seafood');
    expect(guessCategory('boneless chicken breast')).toBe('meat');
    expect(guessCategory('sharp cheddar cheese')).toBe('dairy');
    expect(guessCategory('baby spinach')).toBe('produce');
    expect(guessCategory('ground cinnamon')).toBe('spices');
    expect(guessCategory('dijon mustard')).toBe('condiments');
    expect(guessCategory('sourdough bread')).toBe('bakery');
  });

  it('returns null when it cannot tell', () => {
    expect(guessCategory('florbnak')).toBeNull();
    expect(guessCategory('widget')).toBeNull();
    expect(guessCategory('')).toBeNull();
  });

  it('classifies the aisles a shopping list needs', () => {
    expect(guessCategory('frozen peas')).toBe('frozen');
    expect(guessCategory('vanilla ice cream')).toBe('frozen');
    expect(guessCategory('canned black beans')).toBe('canned');
    expect(guessCategory('chicken broth')).toBe('canned');
    expect(guessCategory('paper towels')).toBe('household');
    expect(guessCategory('dish soap')).toBe('household');
    expect(guessCategory('bran cereal')).toBe('breakfast');
    expect(guessCategory('all-purpose flour')).toBe('baking');
    expect(guessCategory('jasmine rice')).toBe('pantry');
  });

  it('prefers the aisle a modifier implies over the ingredient itself', () => {
    // Shopped in the freezer/canned aisles, not with the fresh stuff.
    expect(guessCategory('frozen chicken tenders')).toBe('frozen');
    expect(guessCategory('canned tuna')).toBe('canned');
    // …but the unmodified ingredient is unchanged.
    expect(guessCategory('chicken tenders')).toBe('meat');
    expect(guessCategory('tuna steak')).toBe('seafood');
  });

  it('keeps snack bars in snacks, not breakfast', () => {
    expect(guessCategory('granola bar')).toBe('snacks');
    expect(guessCategory('granola')).toBe('breakfast');
  });

  it('matches whole words, so lookalikes do not leak in', () => {
    // "pepperoni" must be meat, not produce via "pepper".
    expect(guessCategory('pepperoni')).toBe('meat');
    // "chili powder" is a spice, not produce via "chili"/"chile".
    expect(guessCategory('chili powder')).toBe('spices');
  });

  it('is case-insensitive', () => {
    expect(guessCategory('WHOLE MILK')).toBe('dairy');
  });
});
