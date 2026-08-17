import { describe, expect, it } from 'vitest';

import { isNonFood } from '@/features/ingredients/non-food';

describe('isNonFood', () => {
  it('flags common household and personal-care items', () => {
    for (const name of [
      'toilet paper',
      'Paper Towels',
      'dish soap',
      'laundry detergent',
      'Shampoo',
      'toothpaste',
      'disposable razors',
      'AA batteries',
      'trash bags',
      'cat litter',
      'dog food',
    ]) {
      expect(isNonFood(name)).toBe(true);
    }
  });

  it('catches the ones that mis-categorize as food', () => {
    // "salt" would file this under the Pantry aisle, but the whole phrase is
    // clearly not food — this is the net that doesn't rely on the category.
    expect(isNonFood('water softener salt')).toBe(true);
    expect(isNonFood('epsom salt')).toBe(true);
    expect(isNonFood('cosmetics')).toBe(true);
    expect(isNonFood('makeup remover')).toBe(true);
    expect(isNonFood('motor oil')).toBe(true);
  });

  it('never flags real groceries, including food that shares a non-food word', () => {
    for (const name of [
      'table salt', // "salt" alone is food; only "softener salt" etc. are keywords
      'sea salt',
      'olive oil', // only "motor oil" is a keyword, not bare "oil"
      'vegetable oil',
      'granola bar',
      'pad thai', // "pad" alone isn't a keyword ("maxi pad" is)
      'sponge cake', // bare "sponge" was deliberately dropped
      'soapstone', // whole-word: must not match "soap"
      'chicken breast',
      'rice',
      'bananas',
    ]) {
      expect(isNonFood(name)).toBe(false);
    }
  });
});
