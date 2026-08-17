import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import {
  adjustPantryStock,
  fetchRecipeConsumption,
  listPantry,
  pantryKeys,
  removePantryItem,
  replacePantryPackages,
  setRestockMuted,
  updatePantryItem,
  upsertPantryItem,
  type PackageLine,
  type PantryLocation,
} from '@/features/pantry/api';
import { fetchPantryPrefs, setPantryPref, type PantryPrefs } from '@/features/pantry/pantry-pref-api';
import { shouldTrackInPantry } from '@/features/pantry/track-decision';
import type { ConversionInfo } from '@/features/pricing/price-item';
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
      packages?: PackageLine[];
      info?: ConversionInfo;
    }) => upsertPantryItem(householdId as string, input),
    onSuccess: invalidate,
  });

  // Replace an item's sealed-container breakdown (manual editor). Resets the
  // item's total to the sum of the packages.
  const setPackages = useMutation({
    mutationFn: ({
      id,
      lines,
      unit,
      info,
    }: {
      id: string;
      lines: PackageLine[];
      unit: string | null;
      info?: ConversionInfo;
    }) => replacePantryPackages(id, lines, unit, info ?? {}),
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

  return { add, update, remove, mute, setPackages };
}

/** Query key for a household's per-ingredient pantry-tracking preferences. */
const pantryPrefKey = (householdId: string) => ['pantry-prefs', householdId] as const;

/**
 * Move one bought item into (or out of) the pantry. `add` follows the check-off:
 * checked adds the purchased quantity — whole packages you actually bought when
 * known, else the needed amount — un-checking reverses it. No food/pref gate
 * here; callers decide *whether* to apply. Best-effort: a bad quantity no-ops.
 */
async function applyItemToPantry(householdId: string, item: ShoppingItem, add: boolean) {
  if (!item.canonicalId) return;
  const qty = item.purchase ? item.purchase.totalPurchaseQuantity : item.totalQuantity;
  const unit = item.purchase ? item.purchase.packageUnit : item.unit;
  if (qty == null || qty <= 0) return;
  const infos = await fetchConversionInfos([item.canonicalId]);
  // On a buy with a known container, record the exact sealed package(s) so
  // "2 32oz cans" lands as a stack, not a lump. Removing just decrements.
  const purchasedPackage =
    add && item.purchase
      ? {
          size: item.purchase.packageQuantity,
          unit: item.purchase.packageUnit,
          count: item.purchase.packages,
        }
      : undefined;
  await adjustPantryStock(
    householdId,
    item.canonicalId,
    add ? qty : -qty,
    unit,
    infos[0] ?? {},
    purchasedPackage,
  );
}

/** A household's per-ingredient "track in the pantry?" overrides, by canonical id. */
export function usePantryPrefs() {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: pantryPrefKey(householdId ?? 'none'),
    queryFn: () => fetchPantryPrefs(householdId as string),
    enabled: !!householdId,
  });
}

/**
 * Apply a shopping-list check-off to the pantry. Only canonical-matched *food*
 * items land there — unmatched items and non-food (toilet paper, shampoo, water
 * softener salt…) are skipped, unless the household has pinned the choice with
 * the check-off toggle. `shouldTrackInPantry` is the single gate, so what the
 * status line says is exactly what happens here. Best-effort and silent: the
 * pantry is an estimate, so a failure never blocks the check-off.
 */
export function useApplyPurchaseToPantry() {
  const { householdId } = useHousehold();
  const { data: prefs } = usePantryPrefs();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, checked }: { item: ShoppingItem; checked: boolean }) => {
      if (!householdId) return;
      if (!shouldTrackInPantry(item, prefs ?? {})) return;
      await applyItemToPantry(householdId, item, checked);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pantryKeys.all(householdId ?? 'none') }),
  });
}

/**
 * The "Added to pantry / Not added" toggle on a checked-off item. Remembers the
 * choice for that ingredient (so next time is automatic), and corrects the
 * pantry right now — but only when the item is already checked, since the pantry
 * only mirrors what's been bought. Optimistic so the line flips instantly.
 */
export function useSetPantryTracked() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, tracked }: { item: ShoppingItem; tracked: boolean }) => {
      if (!householdId || !item.canonicalId) return;
      await setPantryPref(householdId, item.canonicalId, tracked);
      if (item.isChecked) await applyItemToPantry(householdId, item, tracked);
    },
    onMutate: async ({ item, tracked }) => {
      if (!item.canonicalId) return;
      const key = pantryPrefKey(householdId ?? 'none');
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PantryPrefs>(key);
      qc.setQueryData(key, { ...(prev ?? {}), [item.canonicalId]: tracked });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      // `prev` is undefined on the first toggle of a session — nothing cached yet.
      // Restoring that (rather than skipping) is what drops the optimistic value,
      // which otherwise sticks while offline, where the refetch below can't run.
      if (ctx) qc.setQueryData(pantryPrefKey(householdId ?? 'none'), ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: pantryPrefKey(householdId ?? 'none') });
      void qc.invalidateQueries({ queryKey: pantryKeys.all(householdId ?? 'none') });
    },
  });
}

/**
 * Add bought quantities to the pantry by canonical id, for things that were
 * never on the list — the receipt closeout finds these. Check-off goes through
 * `useApplyPurchaseToPantry` instead, which has a list item to gate on; here the
 * caller has already decided (the off-list review), so there's no gate.
 */
export function useAddCanonicalToPantry() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    Array<{ canonicalId: string; quantity: number | null; unit: string | null }>
  >({
    mutationFn: async (adds) => {
      if (!householdId || adds.length === 0) return;
      const infos = await fetchConversionInfos(adds.map((a) => a.canonicalId));
      const infoById = new Map(infos.map((i) => [i.canonicalId, i]));
      for (const add of adds) {
        // Receipts often print no quantity. One unit is the honest default — the
        // pantry is an estimate, and a wrong count is easier to fix than a
        // missing item is to notice.
        await adjustPantryStock(
          householdId,
          add.canonicalId,
          add.quantity && add.quantity > 0 ? add.quantity : 1,
          add.unit,
          infoById.get(add.canonicalId) ?? {},
        );
      }
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
