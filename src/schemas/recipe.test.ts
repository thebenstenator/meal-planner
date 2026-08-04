import { describe, expect, it } from 'vitest';

import { recipeFormSchema } from '@/schemas/recipe';

describe('recipeFormSchema', () => {
  it('accepts a minimal valid recipe and coerces servings', () => {
    const r = recipeFormSchema.safeParse({ title: 'Cheesecake', servings: '8' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.servings).toBe(8);
      expect(r.data.mealTypes).toEqual([]);
    }
  });

  it('requires a title', () => {
    expect(recipeFormSchema.safeParse({ title: '  ', servings: 4 }).success).toBe(false);
  });

  it('rejects zero servings', () => {
    expect(recipeFormSchema.safeParse({ title: 'X', servings: 0 }).success).toBe(false);
  });

  it('rejects an unknown meal type', () => {
    const r = recipeFormSchema.safeParse({ title: 'X', servings: 4, mealTypes: ['brunch'] });
    expect(r.success).toBe(false);
  });
});
