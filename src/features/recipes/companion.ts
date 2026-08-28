import { invokeAiFunction } from '@/features/recipes/import';

/** The recipe context sent to the companion — the recipe already on screen. */
export interface CompanionRecipe {
  title: string;
  servings: number | null;
  ingredients: string[];
  instructions: string | null;
}

export interface CompanionMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Ask the recipe companion a question about the recipe on screen (decision 0015).
 * Reuses the shared AI-invoke helper, so hitting the monthly limit comes back as
 * an ImportError with `limitReached` set — the same handling every AI feature
 * uses. One metered credit per question, enforced server-side.
 */
export async function askCompanion(
  householdId: string,
  recipe: CompanionRecipe,
  messages: CompanionMessage[],
): Promise<{ answer: string; creditsRemaining: number }> {
  return invokeAiFunction(
    'recipe-companion',
    { household_id: householdId, recipe, messages },
    'Could not get an answer — try again',
  );
}
