import { describe, expect, it } from 'vitest';

import { parseOneRecipe, parseRecipesText } from '@/features/recipes/bulk-recipes';

describe('parseOneRecipe', () => {
  it('parses a headed recipe', () => {
    const text = `Cheese Danish
Serves 8

Ingredients
2 packages cream cheese
1/2 cup sugar

Directions
Beat the cream cheese and sugar.
Bake at 350.`;
    const r = parseOneRecipe(text);
    expect(r?.title).toBe('Cheese Danish');
    expect(r?.servings).toBe(8);
    expect(r?.ingredientLines).toEqual(['2 packages cream cheese', '1/2 cup sugar']);
    expect(r?.instructions).toBe('Beat the cream cheese and sugar.\nBake at 350.');
  });

  it('uses the fallback title when the block starts with an Ingredients header', () => {
    const r = parseOneRecipe('Ingredients\n2 eggs\n1 cup flour', 'Pancakes');
    expect(r?.title).toBe('Pancakes');
    expect(r?.ingredientLines).toEqual(['2 eggs', '1 cup flour']);
  });

  it('splits with no headers via the heuristic (numbered steps)', () => {
    const r = parseOneRecipe('Guac\n2 avocados\n1 lime\n1. Mash the avocados.\n2. Add lime.');
    expect(r?.title).toBe('Guac');
    expect(r?.ingredientLines).toEqual(['2 avocados', '1 lime']);
    expect(r?.instructions).toContain('Mash the avocados');
  });

  it('finds headers prefixed with PDF glyphs, so intro text is not ingredients', () => {
    // Mirrors a real PDF: title, byline/intro, prep block, then glyph-prefixed
    // "Ingredients" and "Directions" headers.
    const text = [
      'Simple Moist Chocolate Cake Recipe',
      '□ July 8, 2019 By Yummy_treats Difficulty: Medium',
      'This is the most loved recipe in my channel, easy and moist and dense.',
      'Prep Time Cook Time Serving',
      '5 Mins 45 Mins 12 People',
      '□ Ingredients',
      '2 cups flour',
      '1 cup sugar',
      '□ Directions',
      'Mix and bake at 350.',
    ].join('\n');
    const r = parseOneRecipe(text);
    expect(r?.title).toBe('Simple Moist Chocolate Cake Recipe');
    expect(r?.ingredientLines).toEqual(['2 cups flour', '1 cup sugar']);
    expect(r?.instructions).toBe('Mix and bake at 350.');
  });
});

describe('parseRecipesText', () => {
  it('splits multiple recipes on a --- separator', () => {
    const text = `Toast
Ingredients
1 slice bread
Directions
Toast it.
---
Tea
Ingredients
1 tea bag
Directions
Steep it.`;
    const recipes = parseRecipesText(text);
    expect(recipes).toHaveLength(2);
    expect(recipes.map((r) => r.title)).toEqual(['Toast', 'Tea']);
  });
});
