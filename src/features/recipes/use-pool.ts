import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import {
  acceptPoolInvite,
  createPool,
  createPoolInvite,
  deletePool,
  fetchMyPool,
  fetchPoolMembers,
  leavePool,
  poolKeys,
  type PoolInviteResult,
  type RecipePool,
} from '@/features/recipes/pool-api';

/** The pool the active household belongs to (its own or one it joined), or null. */
export function usePool() {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: poolKeys.mine(householdId ?? 'none'),
    queryFn: () => fetchMyPool(householdId as string),
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

/** Invalidate everything a pool change touches: the pool itself + the recipe
 * list (recipes gain/lose their shared pool_id and cross-household visibility). */
function useInvalidatePool() {
  const qc = useQueryClient();
  const { householdId } = useHousehold();
  return () => {
    void qc.invalidateQueries({ queryKey: poolKeys.mine(householdId ?? 'none') });
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
