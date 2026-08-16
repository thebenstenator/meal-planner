import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import { recipeKeys } from '@/features/recipes/api';
import {
  acceptPoolInvite,
  createPool,
  createPoolInvite,
  deletePool,
  fetchMyPools,
  fetchMyRecipeShares,
  fetchPoolMembers,
  leavePool,
  poolKeys,
  setRecipePools,
  shareAllWithPool,
  unshareRecipeFromPool,
  type PoolInviteResult,
  type RecipePool,
} from '@/features/recipes/pool-api';
import { scopeCounts } from '@/features/recipes/scope';

/** Every pool the active household is in (started or joined). */
export function usePools() {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: poolKeys.mine(householdId ?? 'none'),
    queryFn: () => fetchMyPools(householdId as string),
    enabled: !!householdId,
  });
}

export function usePoolMembers(poolId: string | null) {
  return useQuery({
    queryKey: poolKeys.members(poolId ?? 'none'),
    queryFn: () => fetchPoolMembers(poolId as string),
    enabled: !!poolId,
  });
}

/**
 * How much of this household's library sits in each pool — `total` recipes we
 * own, and how many of them each pool holds. Drives the "none of your recipes
 * are here yet" nudge on a pool you joined.
 */
export function useMyShareCounts() {
  const { householdId } = useHousehold();
  const { data: pools } = usePools();
  const poolIds = (pools ?? []).map((p) => p.id);

  const query = useQuery({
    queryKey: poolKeys.myShares(householdId ?? 'none'),
    queryFn: () => fetchMyRecipeShares(householdId as string),
    enabled: !!householdId,
  });

  const counts = scopeCounts(query.data ?? [], poolIds);
  return { total: counts.all, byPool: counts.pools, isLoading: query.isLoading };
}

/** Invalidate everything a pool change touches: the pool itself + the recipe
 * list (recipes gain/lose their shared pool_id and cross-household visibility). */
function useInvalidatePool() {
  const qc = useQueryClient();
  const { householdId } = useHousehold();
  return () => {
    void qc.invalidateQueries({ queryKey: poolKeys.mine(householdId ?? 'none') });
    // ['recipes'] also covers poolKeys.myShares — see the note on that key.
    void qc.invalidateQueries({ queryKey: ['recipes'] });
  };
}

export function useCreatePool() {
  const { householdId } = useHousehold();
  const invalidate = useInvalidatePool();
  return useMutation<RecipePool, Error, string>({
    mutationFn: (name: string) => createPool(householdId as string, name),
    onSuccess: invalidate,
  });
}

export function useCreatePoolInvite(poolId: string | null) {
  return useMutation<PoolInviteResult, Error>({
    mutationFn: () => createPoolInvite(poolId as string),
  });
}

export function useAcceptPoolInvite() {
  const { householdId } = useHousehold();
  const invalidate = useInvalidatePool();
  return useMutation<string, Error, string>({
    mutationFn: (code: string) => acceptPoolInvite(householdId as string, code),
    onSuccess: invalidate,
  });
}

export function useLeavePool() {
  const { householdId } = useHousehold();
  const invalidate = useInvalidatePool();
  return useMutation<void, Error, string>({
    mutationFn: (poolId: string) => leavePool(householdId as string, poolId),
    onSuccess: invalidate,
  });
}

export function useDeletePool() {
  const invalidate = useInvalidatePool();
  return useMutation<void, Error, string>({
    mutationFn: (poolId: string) => deletePool(poolId),
    onSuccess: invalidate,
  });
}

/** Change which pools a recipe is shared into (creator only). */
export function useSetRecipePools() {
  const qc = useQueryClient();
  return useMutation<void, Error, { recipeId: string; poolIds: string[] }>({
    mutationFn: ({ recipeId, poolIds }) => setRecipePools(recipeId, poolIds),
    onSuccess: (_data, { recipeId }) => {
      void qc.invalidateQueries({ queryKey: ['recipes'] });
      void qc.invalidateQueries({ queryKey: recipeKeys.detail(recipeId) });
    },
  });
}

/**
 * Share this household's whole library into a pool it's already in — the
 * deliberate opt-in for someone who *joined* a pool, since joining (unlike
 * creating) doesn't publish anything on its own. Resolves to how many recipes
 * were newly added.
 */
export function useShareAllWithPool() {
  const { householdId } = useHousehold();
  const invalidate = useInvalidatePool();
  return useMutation<number, Error, string>({
    mutationFn: (poolId: string) => shareAllWithPool(householdId as string, poolId),
    onSuccess: invalidate,
  });
}

/** Take a recipe out of one pool (creator, or that pool's owner). */
export function useUnshareRecipe() {
  const qc = useQueryClient();
  return useMutation<void, Error, { recipeId: string; poolId: string }>({
    mutationFn: ({ recipeId, poolId }) => unshareRecipeFromPool(recipeId, poolId),
    onSuccess: (_data, { recipeId }) => {
      void qc.invalidateQueries({ queryKey: ['recipes'] });
      void qc.invalidateQueries({ queryKey: recipeKeys.detail(recipeId) });
    },
  });
}
