import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import {
  createHouseholdCanonical,
  ingredientKeys,
  listCanonical,
  matchCanonical,
  mergeCanonical,
  updateCanonical,
  type CanonicalIngredient,
  type CanonicalInput,
  type MatchResult,
} from '@/features/ingredients/api';

export function useCanonicalList(search: string) {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: ingredientKeys.list(householdId ?? 'none', search),
    queryFn: () => listCanonical(householdId as string, search),
    enabled: !!householdId,
  });
}

/** Button-triggered matcher for the "test the matcher" panel. */
export function useMatchCanonical() {
  const { householdId } = useHousehold();
  return useMutation<MatchResult | null, Error, string>({
    mutationFn: (raw: string) => matchCanonical(householdId as string, raw),
  });
}

function useInvalidateList() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['canonical-ingredients'] });
}

export function useCreateCanonical() {
  const { householdId } = useHousehold();
  const invalidate = useInvalidateList();
  return useMutation<string, Error, CanonicalInput>({
    mutationFn: (input) => createHouseholdCanonical(householdId as string, input),
    onSuccess: invalidate,
  });
}

export function useUpdateCanonical() {
  const invalidate = useInvalidateList();
  return useMutation<void, Error, { id: string; input: CanonicalInput }>({
    mutationFn: ({ id, input }) => updateCanonical(id, input),
    onSuccess: invalidate,
  });
}

export function useMergeCanonical() {
  const invalidate = useInvalidateList();
  return useMutation<void, Error, { sourceId: string; targetId: string }>({
    mutationFn: ({ sourceId, targetId }) => mergeCanonical(sourceId, targetId),
    onSuccess: invalidate,
  });
}

export type { CanonicalIngredient, CanonicalInput, MatchResult };
