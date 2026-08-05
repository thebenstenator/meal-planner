import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import {
  adjustPantryStock,
  listPantry,
  pantryKeys,
  removePantryItem,
  updatePantryItem,
  upsertPantryItem,
  type PantryLocation,
} from '@/features/pantry/api';
import { fetchConversionInfos } from '@/features/pricing/api';
import type { ShoppingItem } from '@/features/shopping-list/api';

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

/**
 * Apply a shopping-list check-off to the pantry: buying (checked) adds the
 * purchased quantity — whole packages you actually bought when known, else the
 * needed amount — and un-checking reverses it. Only canonical-matched items
 * touch the pantry; ad-hoc/unmatched items are skipped. Best-effort and silent:
 * the pantry is an estimate, so a failure here never blocks the check-off.
 */
export function useApplyPurchaseToPantry() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, checked }: { item: ShoppingItem; checked: boolean }) => {
      if (!householdId || !item.canonicalId) return;
      const qty = item.purchase ? item.purchase.totalPurchaseQuantity : item.totalQuantity;
      const unit = item.purchase ? item.purchase.packageUnit : item.unit;
      if (qty == null || qty <= 0) return;
      const infos = await fetchConversionInfos([item.canonicalId]);
      await adjustPantryStock(
        householdId,
        item.canonicalId,
        checked ? qty : -qty,
        unit,
        infos.get(item.canonicalId) ?? {},
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pantryKeys.all(householdId ?? 'none') }),
  });
}
