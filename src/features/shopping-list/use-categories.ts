import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useHousehold } from '@/features/household/use-household';
import {
  categoryKeys,
  createCategory,
  deleteCategory,
  listCategories,
  renameCategory,
  saveCategoryOrder,
} from '@/features/shopping-list/categories-api';
import {
  DEFAULT_CATEGORIES,
  moveCategory,
  type ShoppingCategory,
} from '@/features/shopping-list/categories';

/**
 * The household's shopping categories, in aisle order. Falls back to the
 * defaults while the first fetch is in flight so a list is never rendered
 * ungrouped for a frame.
 */
export function useShoppingCategories(): {
  categories: ShoppingCategory[];
  isLoading: boolean;
  isError: boolean;
} {
  const { householdId } = useHousehold();
  const query = useQuery({
    queryKey: categoryKeys.all(householdId ?? 'none'),
    queryFn: () => listCategories(householdId as string),
    enabled: !!householdId,
    // Categories change rarely; don't refetch them on every list view.
    staleTime: 5 * 60 * 1000,
  });

  return {
    categories: query.data ?? PLACEHOLDER,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

// Ids are only used as React keys / mutation targets, and these rows are
// replaced by the real ones as soon as the query resolves.
const PLACEHOLDER: ShoppingCategory[] = DEFAULT_CATEGORIES.map((c) => ({
  id: c.slug,
  ...c,
}));

/** Create / rename / reorder / delete the household's categories. */
export function useCategoryEdits(categories: ShoppingCategory[]) {
  const { householdId } = useHousehold();
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: categoryKeys.all(householdId ?? 'none') });
    // Items may have been reassigned (delete) or newly groupable (create).
    void qc.invalidateQueries({ queryKey: ['shopping-list'] });
  };

  const add = useMutation<ShoppingCategory, Error, { name: string }>({
    mutationFn: ({ name }) => createCategory(householdId as string, name, categories),
    onSuccess: invalidate,
  });

  const rename = useMutation<void, Error, { id: string; name: string }>({
    mutationFn: ({ id, name }) => renameCategory(id, name),
    onSuccess: invalidate,
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: (id) => deleteCategory(id),
    onSuccess: invalidate,
  });

  const move = useMutation<void, Error, { id: string; direction: 'up' | 'down' }>({
    mutationFn: ({ id, direction }) =>
      saveCategoryOrder(householdId as string, moveCategory(categories, id, direction)),
    // Reordering is a tap-repeatedly interaction: reflect it immediately.
    onMutate: ({ id, direction }) => {
      const key = categoryKeys.all(householdId ?? 'none');
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: unknown) =>
        old ? moveCategory(old as ShoppingCategory[], id, direction) : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      const prev = (ctx as { prev?: unknown } | undefined)?.prev;
      if (prev !== undefined)
        qc.setQueryData(categoryKeys.all(householdId ?? 'none'), prev);
    },
    onSettled: invalidate,
  });

  return { add, rename, remove, move };
}
