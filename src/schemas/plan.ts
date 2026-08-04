import { z } from 'zod';

export const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const slotSchema = z.enum(SLOTS);
export type Slot = z.infer<typeof slotSchema>;

export const PLAN_KINDS = ['recipe', 'leftovers', 'eating_out', 'note'] as const;
export const planKindSchema = z.enum(PLAN_KINDS);
export type PlanKind = z.infer<typeof planKindSchema>;

/** Human labels for the non-recipe kinds. */
export const PLAN_KIND_LABELS: Record<PlanKind, string> = {
  recipe: 'Recipe',
  leftovers: 'Leftovers',
  eating_out: 'Eating out',
  note: 'Note',
};

export const planEntryInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
    slot: slotSchema,
    kind: planKindSchema,
    recipeId: z.string().uuid().nullable().default(null),
    note: z.string().trim().max(500).nullable().default(null),
    servingsOverride: z.number().int().positive().nullable().default(null),
  })
  .refine((v) => (v.kind === 'recipe' ? v.recipeId != null : v.recipeId == null), {
    message: 'A recipe entry needs a recipe; other kinds must not have one',
    path: ['recipeId'],
  });

export type PlanEntryInput = z.infer<typeof planEntryInputSchema>;
