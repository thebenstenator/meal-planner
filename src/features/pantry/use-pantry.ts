import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import {
  listPantry,
  pantryKeys,
  removePantryItem,
  updatePantryItem,
  upsertPantryItem,
  type PantryLocation,
} from '@/features/pantry/api';

export function usePantry() {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: pantryKeys.all(householdId ?? 'none'),
    queryFn: () => listPantry(householdId as string),
    enabled: !!householdId,
  });
}

export function usePantryMutations() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: pantryKeys.all(householdId ?? 'none') });

  const add = useMutation({
    mutationFn: (input: {
      canonicalId: string;
      quantity: number;
      unit: string | null;
      location: PantryLocation;
      expiresOn?: string | null;
    }) => upsertPantryItem(householdId as string, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string;
      quantity?: number;
      unit?: string | null;
      expiresOn?: string | null;
    }) => updatePantryItem(id, patch),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => removePantryItem(id),
    onSuccess: invalidate,
  });

  return { add, update, remove };
}
