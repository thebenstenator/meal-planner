import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import {
  addSmartItem,
  deleteItem,
  deleteShoppingList,
  generateList,
  getOrCreateRunningList,
  getShoppingList,
  listKeys,
  listShoppingLists,
  setCanonicalConversion,
  setItemActualCost,
  setItemChecked,
  updateItemQuantity,
  type SmartAddResult,
} from '@/features/shopping-list/api';

export function useShoppingLists() {
  const { householdId } = useHousehold();
  return useQuery({
    queryKey: listKeys.all(householdId ?? 'none'),
    queryFn: () => listShoppingLists(householdId as string),
    enabled: !!householdId,
  });
}

export function useShoppingList(listId: string) {
  return useQuery({
    queryKey: listKeys.detail(listId),
    queryFn: () => getShoppingList(listId),
    enabled: listId.length > 0,
  });
}

export function useGenerateList() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  return useMutation<
    string,
    Error,
    { name: string; start: string; end: string; listId?: string; subtractPantry?: boolean }
  >({
    mutationFn: (opts) => generateList(householdId as string, opts),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: listKeys.all(householdId ?? 'none') });
      void qc.invalidateQueries({ queryKey: listKeys.detail(id) });
    },
  });
}

export function useToggleItem(listId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, { itemId: string; checked: boolean }>({
    mutationFn: ({ itemId, checked }) => setItemChecked(itemId, checked),
    // Optimistic: flip the checkbox immediately (high-frequency interaction, and
    // it must survive an offline queue). Apply the cache update synchronously —
    // before any await — so a controlled checkbox never flickers back.
    onMutate: ({ itemId, checked }) => {
      const prev = qc.getQueryData(listKeys.detail(listId));
      qc.setQueryData(listKeys.detail(listId), (old: unknown) => {
        const data = old as { summary: unknown; items: Array<{ id: string; isChecked: boolean }> } | undefined;
        if (!data) return old;
        return {
          ...data,
          items: data.items.map((i) => (i.id === itemId ? { ...i, isChecked: checked } : i)),
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      const prev = (ctx as { prev?: unknown } | undefined)?.prev;
      if (prev !== undefined) qc.setQueryData(listKeys.detail(listId), prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKeys.detail(listId) });
    },
  });
}

export function useSetActualCost(listId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, { itemId: string; cents: number | null }>({
    mutationFn: ({ itemId, cents }) => setItemActualCost(itemId, cents),
    // Optimistic like check-off: apply synchronously so the number doesn't flicker.
    onMutate: ({ itemId, cents }) => {
      const prev = qc.getQueryData(listKeys.detail(listId));
      qc.setQueryData(listKeys.detail(listId), (old: unknown) => {
        const data = old as
          | { summary: unknown; items: Array<{ id: string; actualCostCents: number | null }> }
          | undefined;
        if (!data) return old;
        return {
          ...data,
          items: data.items.map((i) => (i.id === itemId ? { ...i, actualCostCents: cents } : i)),
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      const prev = (ctx as { prev?: unknown } | undefined)?.prev;
      if (prev !== undefined) qc.setQueryData(listKeys.detail(listId), prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: listKeys.detail(listId) });
    },
  });
}

export function useDeleteShoppingList() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteShoppingList(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: listKeys.all(householdId ?? 'none') }),
  });
}

/** Item-level edits on a list: add a smart item, override quantity, delete. */
export function useItemEdits(listId: string) {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: listKeys.detail(listId) });

  const addItem = useMutation<
    SmartAddResult,
    Error,
    { name: string; quantity: number | null; unit: string | null }
  >({
    mutationFn: (input) => addSmartItem(householdId as string, listId, input),
    onSuccess: invalidate,
  });
  const overrideQuantity = useMutation<
    void,
    Error,
    { itemId: string; totalQuantity: number | null; unit: string | null }
  >({
    mutationFn: ({ itemId, totalQuantity, unit }) =>
      updateItemQuantity(itemId, { totalQuantity, unit }),
    onSuccess: invalidate,
  });
  const removeItem = useMutation<void, Error, string>({
    mutationFn: (itemId) => deleteItem(itemId),
    onSuccess: invalidate,
  });

  return { addItem, overrideQuantity, removeItem };
}

/**
 * Jot an item onto the household's standing running list — created on first use.
 * Returns whether it was added or was already there, plus the list id.
 */
export function useAddToRunningList() {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  return useMutation<
    { result: SmartAddResult; listId: string },
    Error,
    { name: string; quantity: number | null; unit: string | null }
  >({
    mutationFn: async (input) => {
      const listId = await getOrCreateRunningList(householdId as string);
      const result = await addSmartItem(householdId as string, listId, input);
      return { result, listId };
    },
    onSuccess: ({ listId }) => {
      void qc.invalidateQueries({ queryKey: listKeys.all(householdId ?? 'none') });
      void qc.invalidateQueries({ queryKey: listKeys.detail(listId) });
    },
  });
}

/** Save a conversion to a canonical ingredient, then regenerate to merge. */
export function useSetConversion() {
  return useMutation<
    void,
    Error,
    { canonicalId: string; densityGPerMl?: number; countToGram?: number }
  >({
    mutationFn: ({ canonicalId, densityGPerMl, countToGram }) =>
      setCanonicalConversion(canonicalId, { densityGPerMl, countToGram }),
  });
}
