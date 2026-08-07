import { weekRange } from '@/features/planner/dates';
import type { RecipeDetail } from '@/features/recipes/api';
import { invokeAiFunction, urlImportToDetail } from '@/features/recipes/import';
import {
  addAdHocItem,
  generateList,
  listShoppingLists,
} from '@/features/shopping-list/api';

export interface MealIdea {
  title: string;
  pitch: string;
  time_estimate: string;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  instructions: string | null;
  ingredient_lines: string[];
  /** The user's ingredients this idea uses (their wording). */
  uses: string[];
  /** Non-staple ingredients the idea needs that the user didn't have. */
  missing: string[];
}

/** Ask the suggest-meals Edge Function for dinner ideas from a set of ingredients. */
export async function suggestMeals(
  householdId: string,
  ingredients: string[],
  filters: string[] = [],
  count = 3,
): Promise<MealIdea[]> {
  const data = await invokeAiFunction<{ meals: MealIdea[] }>(
    'suggest-meals',
    { ingredients, filters, count, household_id: householdId },
    'Could not come up with ideas',
  );
  return data.meals;
}

/**
 * Turn an idea into a review-ready RecipeDetail. An idea already has the URL-
 * import shape (title/servings/times/instructions/ingredient_lines), so we reuse
 * that exact path: engine-parse the lines and match each to a canonical one.
 */
export function ideaToDetail(householdId: string, idea: MealIdea): Promise<RecipeDetail> {
  return urlImportToDetail(householdId, idea, 'AI suggestion');
}

/**
 * Add an idea's missing ingredients to a shopping list. Uses the newest list if
 * there is one; otherwise creates one for the current week. Returns the list id.
 */
export async function addMissingToList(
  householdId: string,
  missing: string[],
): Promise<string> {
  const lists = await listShoppingLists(householdId);
  let listId = lists[0]?.id;
  if (!listId) {
    const { start, end } = weekRange(new Date());
    listId = await generateList(householdId, { name: 'Shopping list', start, end });
  }
  for (const name of missing) {
    await addAdHocItem(listId, { name, quantity: null, unit: null });
  }
  return listId;
}
