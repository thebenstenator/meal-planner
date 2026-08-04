import { z } from 'zod';

export const MEAL_TYPES = ['main', 'side', 'dessert', 'snack', 'breakfast', 'drink'] as const;
export const mealTypeSchema = z.enum(MEAL_TYPES);
export type MealType = z.infer<typeof mealTypeSchema>;

/** Scalar fields of the recipe form (ingredient rows are managed separately). */
export const recipeFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).optional(),
  mealTypes: z.array(mealTypeSchema).default([]),
  servings: z.coerce.number().int().min(1, 'At least 1 serving').max(100),
  prepMinutes: z.coerce.number().int().min(0).max(100000).nullable().optional(),
  cookMinutes: z.coerce.number().int().min(0).max(100000).nullable().optional(),
  instructions: z.string().trim().max(20000).optional(),
  source: z.string().trim().max(300).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type RecipeFormInput = z.infer<typeof recipeFormSchema>;
