import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import {
  adjustPantryStock,
  fetchRecipeConsumption,
  listPantry,
  pantryKeys,
  removePantryItem,
  setRestockMuted,
  updatePantryItem,
  upsertPantryItem,
  type PantryLocation,
} from '@/features/pantry/api';
import { planKeys, setEntryCooked, type PlanEntry } from '@/features/planner/api';
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
      amountUnknown?: boolean;
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
      amountUnknown?: boolean;
    }) => updatePantryItem(id, patch),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => removePantryItem(id),
    onSuccess: invalidate,
  });

  const mute = useMutation({
    mutationFn: (id: string) => setRestockMuted(id, true),
    onSuccess: invalidate,
  });

  return { add, update, remove, mute };
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
        infos[0] ?? {},
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pantryKeys.all(householdId ?? 'none') }),
  });
}

/**
 * Mark a planned meal cooked (or not) and move its recipe's ingredients out of
 * (or back into) the pantry, scaled by any servings override. cooked_at on the
 * entry is the idempotent guard. Best-effort like the purchase sync.
 */
export function useMarkCooked() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entry, cooked }: { entry: PlanEntry; cooked: boolean }) => {
      await setEntryCooked(entry.id, cooked);
      if (!householdId || entry.kind !== 'recipe' || !entry.recipeId) return;
      const { servings, ingredients } = await fetchRecipeConsumption(entry.recipeId);
      const scale = entry.servingsOverride && servings ? entry.servingsOverride / servings : 1;
      const ids = [...new Set(ingredients.map((i) => i.canonicalId))];
      const infos = await fetchConversionInfos(ids);
      const infoById = new Map(infos.map((i) => [i.canonicalId, i]));
      const sign = cooked ? -1 : 1;
      for (const ing of ingredients) {
        if (ing.quantity == null) continue;
        await adjustPantryStock(
          householdId,
          ing.canonicalId,
          sign * ing.quantity * scale,
          ing.unit,
          infoById.get(ing.canonicalId) ?? {},
        );
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pantryKeys.all(householdId ?? 'none') });
      void qc.invalidateQueries({ queryKey: planKeys.all(householdId ?? 'none') });
    },
  });
}
