import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import { recipeKeys } from '@/features/recipes/api';
import {
  acceptCookbookInvite,
  cookbookKeys,
  createCookbook,
  createCookbookInvite,
  deleteCookbook,
  fetchCookbookMembers,
  fetchMyCookbooks,
  fetchMyRecipeShares,
  leaveCookbook,
  setRecipeCookbooks,
  shareAllWithCookbook,
  unshareRecipeFromCookbook,
  type Cookbook,
  type CookbookInviteResult,
} from '@/features/recipes/cookbook-api';
import { scopeCounts } from '@/features/recipes/scope';

/** Every cookbook the active household is in (started or joined). */
export function useCookbooks() {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: cookbookKeys.mine(householdId ?? 'none'),
    queryFn: () => fetchMyCookbooks(householdId as string),
    enabled: !!householdId,
  });
}

export function useCookbookMembers(cookbookId: string | null) {
  return useQuery({
    queryKey: cookbookKeys.members(cookbookId ?? 'none'),
    queryFn: () => fetchCookbookMembers(cookbookId as string),
    enabled: !!cookbookId,
  });
}

/**
 * How much of this household's library sits in each cookbook — `total` recipes
 * we own, and how many of them each cookbook holds. Drives the "none of your
 * recipes are here yet" nudge on a cookbook you joined.
 */
export function useMyShareCounts() {
  const { householdId } = useHousehold();
  const { data: cookbooks } = useCookbooks();
  const cookbookIds = (cookbooks ?? []).map((c) => c.id);

  const query = useQuery({
    queryKey: cookbookKeys.myShares(householdId ?? 'none'),
    queryFn: () => fetchMyRecipeShares(householdId as string),
    enabled: !!householdId,
  });

  const counts = scopeCounts(query.data ?? [], cookbookIds);
  return { total: counts.all, byCookbook: counts.cookbooks, isLoading: query.isLoading };
}

/** Invalidate everything a cookbook change touches: the cookbook itself + the
 * recipe list (recipes gain/lose their shared pool_id and cross-household
 * visibility). */
function useInvalidateCookbook() {
  const qc = useQueryClient();
  const { householdId } = useHousehold();
  return () => {
    void qc.invalidateQueries({ queryKey: cookbookKeys.mine(householdId ?? 'none') });
    // ['recipes'] also covers cookbookKeys.myShares — see the note on that key.
    void qc.invalidateQueries({ queryKey: ['recipes'] });
  };
}

export function useCreateCookbook() {
  const { householdId } = useHousehold();
  const invalidate = useInvalidateCookbook();
  return useMutation<Cookbook, Error, string>({
    mutationFn: (name: string) => createCookbook(householdId as string, name),
    onSuccess: invalidate,
  });
}

export function useCreateCookbookInvite(cookbookId: string | null) {
  return useMutation<CookbookInviteResult, Error>({
    mutationFn: () => createCookbookInvite(cookbookId as string),
  });
}

export function useAcceptCookbookInvite() {
  const { householdId } = useHousehold();
  const invalidate = useInvalidateCookbook();
  return useMutation<string, Error, string>({
    mutationFn: (code: string) => acceptCookbookInvite(householdId as string, code),
    onSuccess: invalidate,
  });
}

export function useLeaveCookbook() {
  const { householdId } = useHousehold();
  const invalidate = useInvalidateCookbook();
  return useMutation<void, Error, string>({
    mutationFn: (cookbookId: string) => leaveCookbook(householdId as string, cookbookId),
    onSuccess: invalidate,
  });
}

export function useDeleteCookbook() {
  const invalidate = useInvalidateCookbook();
  return useMutation<void, Error, string>({
    mutationFn: (cookbookId: string) => deleteCookbook(cookbookId),
    onSuccess: invalidate,
  });
}

/** Change which cookbooks a recipe is shared into (creator only). */
export function useSetRecipeCookbooks() {
  const qc = useQueryClient();
  return useMutation<void, Error, { recipeId: string; cookbookIds: string[] }>({
    mutationFn: ({ recipeId, cookbookIds }) => setRecipeCookbooks(recipeId, cookbookIds),
    onSuccess: (_data, { recipeId }) => {
      void qc.invalidateQueries({ queryKey: ['recipes'] });
      void qc.invalidateQueries({ queryKey: recipeKeys.detail(recipeId) });
    },
  });
}

/**
 * Share this household's whole library into a cookbook it's already in — the
 * deliberate opt-in for someone who *joined* a cookbook, since joining (unlike
 * creating) doesn't publish anything on its own. Resolves to how many recipes
 * were newly added.
 */
export function useShareAllWithCookbook() {
  const { householdId } = useHousehold();
  const invalidate = useInvalidateCookbook();
  return useMutation<number, Error, string>({
    mutationFn: (cookbookId: string) => shareAllWithCookbook(householdId as string, cookbookId),
    onSuccess: invalidate,
  });
}

/** Take a recipe out of one cookbook (creator, or that cookbook's owner). */
export function useUnshareRecipe() {
  const qc = useQueryClient();
  return useMutation<void, Error, { recipeId: string; cookbookId: string }>({
    mutationFn: ({ recipeId, cookbookId }) => unshareRecipeFromCookbook(recipeId, cookbookId),
    onSuccess: (_data, { recipeId }) => {
      void qc.invalidateQueries({ queryKey: ['recipes'] });
      void qc.invalidateQueries({ queryKey: recipeKeys.detail(recipeId) });
    },
  });
}
