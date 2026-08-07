import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import { usePantry } from '@/features/pantry/use-pantry';
import {
  aiTargetForDays,
  buildMonthPlan,
  type LibraryRecipe,
  type NoveltyLevel,
} from '@/features/planner/autofill';
import { createPlanEntry, planKeys } from '@/features/planner/api';
import { toISO } from '@/features/planner/dates';
import { listLibraryForAutofill, saveRecipe } from '@/features/recipes/api';
import { ideaToDetail, suggestMeals, type MealIdea } from '@/features/recipes/suggest';
import type { Slot } from '@/schemas/plan';

/** A single filled cell in an auto-fill proposal, ready to review + edit. */
export interface ProposalRow {
  date: string;
  slot: Slot;
  source: 'library' | 'ai';
  /** Resolved display title (library title or AI idea title). */
  title: string;
  /** Set when the row points at an existing library recipe. */
  recipeId?: string;
  /** Set for a fresh AI idea (not yet saved as a recipe). */
  idea?: MealIdea;
}

export interface GenerateArgs {
  days: string[];
  slots: Slot[];
  novelty: NoveltyLevel;
}

export interface Proposal {
  rows: ProposalRow[];
  library: LibraryRecipe[];
  /** How many fresh AI ideas actually came back (0 if the level asked for none). */
  aiCount: number;
}

// Sensible general-purpose seed when the pantry is empty, so the AI still has
// something to riff on for "fresh ideas".
const DEFAULT_SEED = [
  'chicken',
  'ground beef',
  'pasta',
  'rice',
  'eggs',
  'onions',
  'canned tomatoes',
  'cheese',
  'beans',
  'potatoes',
];

/**
 * Build a balanced month proposal: pull the library with its cook-stat signals,
 * ask the AI for a *capped* number of fresh ideas (one metered credit, at most
 * 5 ideas), then run the pure `buildMonthPlan` balancer. Returns a reviewable,
 * editable proposal — nothing is saved until `useCommitProposal` runs.
 */
export function useGenerateProposal() {
  const { householdId } = useHousehold();
  const { data: pantry } = usePantry();

  return useMutation<Proposal, Error, GenerateArgs>({
    mutationFn: async ({ days, slots, novelty }) => {
      const id = householdId as string;
      const library = await listLibraryForAutofill(id);

      const target = aiTargetForDays(days.length, novelty);
      let ideas: MealIdea[] = [];
      if (target > 0) {
        const seed = pantry && pantry.length > 0
          ? [...new Set(pantry.map((p) => p.canonicalName))].slice(0, 20)
          : DEFAULT_SEED;
        // suggest-meals caps at 5 per call; one credit keeps the flagship cheap.
        ideas = await suggestMeals(id, seed, [], Math.min(5, target));
      }

      const plan = buildMonthPlan({
        days,
        slots,
        library,
        aiIdeaCount: ideas.length,
        novelty,
        today: toISO(new Date()),
      });

      const byId = new Map(library.map((r) => [r.id, r]));
      const rows: ProposalRow[] = plan.map((a) =>
        a.source === 'library'
          ? {
              date: a.date,
              slot: a.slot,
              source: 'library',
              recipeId: a.recipeId,
              title: byId.get(a.recipeId as string)?.title ?? 'Recipe',
            }
          : {
              date: a.date,
              slot: a.slot,
              source: 'ai',
              idea: ideas[a.aiIndex as number],
              title: ideas[a.aiIndex as number]?.title ?? 'New idea',
            },
      );

      return { rows, library, aiCount: ideas.length };
    },
  });
}

/**
 * Commit a reviewed proposal: save each unique fresh AI idea as a real recipe
 * once, then create a plan_entry for every row. Library rows point straight at
 * their existing recipe. Invalidates the plan so the calendar refreshes.
 */
export function useCommitProposal() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();

  return useMutation<void, Error, ProposalRow[]>({
    mutationFn: async (rows) => {
      const id = householdId as string;

      // Save fresh ideas first (dedup by idea identity — one recipe per idea).
      const savedIdea = new Map<MealIdea, string>();
      for (const row of rows) {
        if (row.source === 'ai' && row.idea && !savedIdea.has(row.idea)) {
          savedIdea.set(row.idea, await saveIdeaAsRecipe(id, row.idea));
        }
      }

      for (const row of rows) {
        const recipeId =
          row.source === 'library' ? row.recipeId : savedIdea.get(row.idea as MealIdea);
        if (!recipeId) continue;
        await createPlanEntry(id, {
          date: row.date,
          slot: row.slot,
          kind: 'recipe',
          recipeId,
          note: null,
          servingsOverride: null,
        });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: planKeys.all(householdId ?? 'none') });
      void qc.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

/** Persist an AI idea as a dinner recipe via the same review path the suggest page uses. */
async function saveIdeaAsRecipe(householdId: string, idea: MealIdea): Promise<string> {
  const detail = await ideaToDetail(householdId, idea);
  return saveRecipe(
    householdId,
    {
      title: detail.title,
      servings: detail.servings,
      mealTypes: ['main'],
      tags: [],
      instructions: detail.instructions ?? undefined,
      source: 'Auto-fill',
    },
    detail.ingredients,
  );
}
