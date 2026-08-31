import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import {
  categorizeUncategorizedRecipes,
  getRecipe,
  listDeletedRecipes,
  listRecipes,
  recipeKeys,
  restoreRecipe,
  saveRecipe,
  setRecipeFavorite,
  setRecipeManualCost,
  softDeleteRecipe,
  type RecipeIngredientDraft,
} from '@/features/recipes/api';
import type { RecipeFormInput } from '@/schemas/recipe';

export function useRecipeList(search: string, mealType: string) {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: recipeKeys.list(householdId ?? 'none', search, mealType),
    queryFn: () => listRecipes(householdId as string, { search, mealType: mealType || undefined }),
    enabled: !!householdId,
  });
}

export function useDeletedRecipes() {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: recipeKeys.deleted(householdId ?? 'none'),
    queryFn: () => listDeletedRecipes(householdId as string),
    enabled: !!householdId,
  });
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: recipeKeys.detail(id),
    queryFn: () => getRecipe(id),
    enabled: id.length > 0,
  });
}

function useInvalidateRecipes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['recipes'] });
}

export function useSaveRecipe() {
  const { householdId } = useHousehold();
  const invalidate = useInvalidateRecipes();
  const qc = useQueryClient();
  return useMutation<
    string,
    Error,
    {
      form: RecipeFormInput;
      ingredients: RecipeIngredientDraft[];
      recipeId?: string;
      cookbookIds?: string[];
      forkedFromId?: string;
    }
  >({
    mutationFn: ({ form, ingredients, recipeId, cookbookIds, forkedFromId }) =>
      saveRecipe(householdId as string, form, ingredients, recipeId, cookbookIds, forkedFromId),
    onSuccess: (id) => {
      invalidate();
      void qc.invalidateQueries({ queryKey: recipeKeys.detail(id) });
    },
  });
}

export function useSetFavorite(recipeId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateRecipes();
  return useMutation<void, Error, boolean>({
    mutationFn: (favorite) => setRecipeFavorite(recipeId, favorite),
    onMutate: (favorite) => {
      qc.setQueryData(recipeKeys.detail(recipeId), (old: unknown) =>
        old ? { ...(old as object), isFavorite: favorite } : old,
      );
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: recipeKeys.detail(recipeId) });
      invalidate();
    },
  });
}

/**
 * Set or clear (null) a recipe's manual meal price. Invalidates the recipe detail
 * *and* the planner cost inputs so the meal card / budget bar re-cost immediately.
 * Keyed by recipe rather than a detail object, so the planner can call it with
 * just an entry's recipeId.
 */
export function useSetRecipeManualCost(recipeId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateRecipes();
  return useMutation<void, Error, number | null>({
    mutationFn: (cents) => setRecipeManualCost(recipeId, cents),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: recipeKeys.detail(recipeId) });
      void qc.invalidateQueries({ queryKey: ['recipe-cost-inputs'] });
      invalidate();
    },
  });
}

export function useSoftDeleteRecipe() {
  const invalidate = useInvalidateRecipes();
  return useMutation<void, Error, string>({
    mutationFn: (id) => softDeleteRecipe(id),
    onSuccess: invalidate,
  });
}

export function useRestoreRecipe() {
  const invalidate = useInvalidateRecipes();
  return useMutation<void, Error, string>({
    mutationFn: (id) => restoreRecipe(id),
    onSuccess: invalidate,
  });
}

/** Backfill meal types onto recipes imported before they were categorized. */
export function useCategorizeUncategorized() {
  const { householdId } = useHousehold();
  const invalidate = useInvalidateRecipes();
  return useMutation<number, Error, void>({
    mutationFn: () => categorizeUncategorizedRecipes(householdId as string),
    onSuccess: invalidate,
  });
}
