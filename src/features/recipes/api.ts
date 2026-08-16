import type { LibraryRecipe } from '@/features/planner/autofill';
import { guessMealTypes } from '@/features/recipes/guess-meal-type';
import { setRecipeCookbooks } from '@/features/recipes/cookbook-api';
import type { MealType, RecipeFormInput } from '@/schemas/recipe';
import { supabase } from '@/lib/supabase/client';

export const recipeKeys = {
  list: (householdId: string, search: string, mealType: string) =>
    ['recipes', householdId, { search, mealType }] as const,
  deleted: (householdId: string) => ['recipes', householdId, 'deleted'] as const,
  detail: (id: string) => ['recipe', id] as const,
};

/** One ingredient row in the editor and in save payloads. */
export interface RecipeIngredientDraft {
  id?: string;
  rawText: string;
  quantity: number | null;
  unit: string | null;
  canonicalId: string | null;
  canonicalName: string | null;
  /** Core ingredient name the parser extracted (e.g. "cream cheese"); used to
   * pre-fill the match/create box for rows that didn't match a canonical one. */
  parsedName?: string | null;
  descriptor: string | null;
  isOptional: boolean;
  parseConfidence: number | null;
  needsReview: boolean;
}

export interface RecipeSummary {
  id: string;
  title: string;
  mealTypes: string[];
  servings: number;
  tags: string[];
  timesCooked: number;
  ingredientCount: number;
  updatedAt: string;
  /** Cookbooks this recipe is shared into; empty when it's private. */
  cookbookIds: string[];
  /** True when the active household created this recipe (can edit/favorite it). */
  ownedByMe: boolean;
}

export interface RecipeDetail {
  id: string;
  title: string;
  /** Creator household; compare to the active household for ownership. */
  householdId: string;
  /** Cookbooks this recipe is shared into; empty when it's private. */
  cookbookIds: string[];
  description: string | null;
  mealTypes: string[];
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  instructions: string | null;
  source: string | null;
  tags: string[];
  notes: string | null;
  rating: number | null;
  timesCooked: number;
  isFavorite: boolean;
  ingredients: RecipeIngredientDraft[];
}

const LIST_SELECT =
  'id, title, household_id, meal_types, servings, tags, times_cooked, updated_at, recipe_pool_share(pool_id), recipe_ingredient(count)';

export async function listRecipes(
  householdId: string,
  opts: { search?: string; mealType?: string } = {},
): Promise<RecipeSummary[]> {
  // No household filter: RLS returns this household's recipes *and* any shared
  // cookbook's recipes. `householdId` is used only to mark which ones you own.
  let query = supabase
    .from('recipe')
    .select(LIST_SELECT)
    .is('deleted_at', null)
    .order('title', { ascending: true })
    .limit(200);

  const search = opts.search?.trim();
  if (search) query = query.ilike('title', `%${search}%`);
  if (opts.mealType) query = query.contains('meal_types', [opts.mealType]);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? [])
    .map((r) => ({
      id: r.id,
      title: r.title,
      mealTypes: r.meal_types ?? [],
      servings: r.servings,
      tags: r.tags ?? [],
      timesCooked: r.times_cooked,
      ingredientCount: r.recipe_ingredient?.[0]?.count ?? 0,
      updatedAt: r.updated_at,
      cookbookIds: (r.recipe_pool_share ?? []).map((s) => s.pool_id),
      ownedByMe: r.household_id === householdId,
    }))
    // Case-insensitive alphabetical, so "apple" and "Banana" sort naturally.
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
}

export async function getRecipe(id: string): Promise<RecipeDetail> {
  const { data, error } = await supabase
    .from('recipe')
    .select('*, recipe_pool_share(pool_id), recipe_ingredient(*, canonical_ingredient(name))')
    .eq('id', id)
    .is('deleted_at', null)
    .order('position', { referencedTable: 'recipe_ingredient', ascending: true })
    .single();
  if (error) throw error;

  return {
    id: data.id,
    title: data.title,
    householdId: data.household_id,
    cookbookIds: (data.recipe_pool_share ?? []).map((s) => s.pool_id),
    description: data.description,
    mealTypes: data.meal_types ?? [],
    servings: data.servings,
    prepMinutes: data.prep_minutes,
    cookMinutes: data.cook_minutes,
    instructions: data.instructions,
    source: data.source,
    tags: data.tags ?? [],
    notes: data.notes,
    rating: data.rating,
    timesCooked: data.times_cooked,
    isFavorite: data.is_favorite,
    ingredients: (data.recipe_ingredient ?? []).map((ri) => ({
      id: ri.id,
      rawText: ri.raw_text,
      quantity: ri.quantity,
      unit: ri.unit,
      canonicalId: ri.canonical_ingredient_id,
      canonicalName: ri.canonical_ingredient?.name ?? null,
      descriptor: ri.descriptor,
      isOptional: ri.is_optional,
      parseConfidence: ri.parse_confidence,
      needsReview: ri.needs_review,
    })),
  };
}

export async function saveRecipe(
  householdId: string,
  form: RecipeFormInput,
  ingredients: RecipeIngredientDraft[],
  recipeId?: string,
  /** The exact set of cookbooks to share this recipe into, replacing whatever it
   * was. Omit (undefined) to leave sharing untouched — pass `[]` to unshare. */
  cookbookIds?: string[],
): Promise<string> {
  const p_recipe = {
    household_id: householdId,
    title: form.title,
    description: form.description ?? null,
    meal_types: form.mealTypes,
    servings: form.servings,
    prep_minutes: form.prepMinutes ?? null,
    cook_minutes: form.cookMinutes ?? null,
    instructions: form.instructions ?? null,
    source: form.source ?? null,
    tags: form.tags,
  };
  const p_ingredients = ingredients
    .filter((i) => i.rawText.trim().length > 0)
    .map((i) => ({
      raw_text: i.rawText,
      quantity: i.quantity,
      unit: i.unit,
      canonical_ingredient_id: i.canonicalId,
      descriptor: i.descriptor,
      is_optional: i.isOptional,
      parse_confidence: i.parseConfidence,
      needs_review: i.needsReview,
    }));

  const { data, error } = await supabase.rpc('save_recipe', {
    p_recipe,
    p_ingredients,
    p_recipe_id: recipeId,
  });
  if (error) throw error;

  const id = data as string;
  // Sharing lives in its own table, so it's a second call — which is also what
  // lets an *edit* change where a recipe is shared, not just a create.
  if (cookbookIds) await setRecipeCookbooks(id, cookbookIds);
  return id;
}

export async function softDeleteRecipe(id: string): Promise<void> {
  const { error } = await supabase
    .from('recipe')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function restoreRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipe').update({ deleted_at: null }).eq('id', id);
  if (error) throw error;
}

/**
 * All of a household's live recipes with just the signals the month auto-fill
 * ranks on (favorite / times-cooked / haven't-made-in-a-while). Kept lean — this
 * feeds the pure `buildMonthPlan` balancer, not the recipe list UI.
 */
export async function listLibraryForAutofill(householdId: string): Promise<LibraryRecipe[]> {
  const { data, error } = await supabase
    .from('recipe')
    .select('id, title, meal_types, is_favorite, times_cooked, last_cooked_on')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    isFavorite: r.is_favorite,
    timesCooked: r.times_cooked,
    lastCookedOn: r.last_cooked_on,
    // Untagged recipes stay eligible for nothing on purpose: dinner draws only
    // from real mains. The recipe library's "Categorize" nudge backfills these.
    mealTypes: (r.meal_types ?? []) as MealType[],
  }));
}

export async function setRecipeFavorite(id: string, favorite: boolean): Promise<void> {
  const { error } = await supabase.from('recipe').update({ is_favorite: favorite }).eq('id', id);
  if (error) throw error;
}

/**
 * Give every still-uncategorized recipe a meal type guessed from its title, so
 * the month auto-fill's slot filter has something to work with (and the library
 * shows the right badges). One-off cleanup for recipes imported before meal
 * types were assigned; returns how many were categorized. Titles that don't
 * match a keyword rule become mains — the guess's sensible default.
 */
export async function categorizeUncategorizedRecipes(householdId: string): Promise<number> {
  const { data, error } = await supabase
    .from('recipe')
    .select('id, title')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .or('meal_types.is.null,meal_types.eq.{}')
    .limit(1000);
  if (error) throw error;

  const untagged = data ?? [];
  for (const r of untagged) {
    const { error: updateError } = await supabase
      .from('recipe')
      .update({ meal_types: guessMealTypes(r.title) })
      .eq('id', r.id);
    if (updateError) throw updateError;
  }
  return untagged.length;
}

export async function listDeletedRecipes(householdId: string): Promise<RecipeSummary[]> {
  const { data, error } = await supabase
    .from('recipe')
    .select(LIST_SELECT)
    .eq('household_id', householdId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    mealTypes: r.meal_types ?? [],
    servings: r.servings,
    tags: r.tags ?? [],
    timesCooked: r.times_cooked,
    ingredientCount: r.recipe_ingredient?.[0]?.count ?? 0,
    updatedAt: r.updated_at,
    cookbookIds: (r.recipe_pool_share ?? []).map((s) => s.pool_id),
    ownedByMe: r.household_id === householdId,
  }));
}
