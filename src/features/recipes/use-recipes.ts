import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import {
  getRecipe,
  listDeletedRecipes,
  listRecipes,
  recipeKeys,
  restoreRecipe,
  saveRecipe,
  setRecipeFavorite,
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
    { form: RecipeFormInput; ingredients: RecipeIngredientDraft[]; recipeId?: string }
  >({
    mutationFn: ({ form, ingredients, recipeId }) =>
      saveRecipe(householdId as string, form, ingredients, recipeId),
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
