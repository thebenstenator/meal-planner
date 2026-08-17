import type { MutationKey, QueryClient } from '@tanstack/react-query';

import { listKeys } from '@/features/shopping-list/keys';

/**
 * Which writes are allowed to survive a reload while offline.
 *
 * A paused mutation is persisted with its *variables* but not its `mutationFn` —
 * a function can't be serialized. Rehydrating one therefore produces a mutation
 * with nothing to call, and resuming it just throws. TanStack's fix is to look
 * the function back up by `mutationKey` via `setMutationDefaults`, which is what
 * `registerOfflineMutations` does below.
 *
 * That lookup only works for a mutation whose entire input is in its variables.
 * Anything that closes over a hook value (householdId), resolves an id at call
 * time, or costs money to retry (the AI receipt scan) is deliberately *not*
 * here, and `shouldPersistMutation` drops it rather than replaying it blind.
 *
 * Both entries below take only ids and a value, which is why they qualify — and
 * they're also the two writes people actually make standing in an aisle with no
 * signal, so this list is short on purpose rather than by omission.
 */
export const offlineMutationKeys = {
  toggleItem: ['shopping-item', 'checked'] as const,
  setActualCost: ['shopping-item', 'actual-cost'] as const,
};

const PERSISTED = [offlineMutationKeys.toggleItem, offlineMutationKeys.setActualCost];

/**
 * Reattach the `mutationFn` to any write restored from storage.
 *
 * Must run before the persister rehydrates, so the defaults are already
 * registered when the mutation cache is restored. This runs on every startup,
 * so the writes are pulled in dynamically — `shopping-list/api` reaches the
 * ingredient engine, and nobody should pay for that on first paint to support a
 * replay that almost never happens.
 */
export function registerOfflineMutations(client: QueryClient): void {
  // A resumed mutation has no component behind it, so the hook's own onSettled
  // never runs. Refetch every list: the resumed write's listId isn't in its
  // variables, and this happens once, on reconnect.
  const refetchLists = () => {
    void client.invalidateQueries({ queryKey: listKeys.allDetails() });
  };

  client.setMutationDefaults(offlineMutationKeys.toggleItem, {
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      const { setItemChecked } = await import('@/features/shopping-list/api');
      await setItemChecked(itemId, checked);
    },
    onSettled: refetchLists,
  });

  client.setMutationDefaults(offlineMutationKeys.setActualCost, {
    mutationFn: async ({ itemId, cents }: { itemId: string; cents: number | null }) => {
      const { setItemActualCost } = await import('@/features/shopping-list/api');
      await setItemActualCost(itemId, cents);
    },
    onSettled: refetchLists,
  });
}

/**
 * Persist a paused mutation only if we can actually revive it.
 *
 * The default policy persists *every* paused mutation, which for the rest of
 * the app means writing a write we can never replay — it comes back without a
 * `mutationFn` and dies on resume, while its optimistic update sits in the
 * persisted query cache looking successful. Dropping it here at least keeps the
 * cache honest: a refetch corrects the screen instead of leaving a check mark
 * that never reached the server.
 */
/**
 * Just the parts of a Mutation this decision reads. `Mutation`'s four generics
 * default to types no real mutation satisfies, so naming them here keeps the
 * signature honest without an `any` — any Mutation structurally fits.
 */
interface PersistableMutation {
  state: { isPaused: boolean };
  options: { mutationKey?: MutationKey };
}

export function shouldPersistMutation(mutation: PersistableMutation): boolean {
  if (!mutation.state.isPaused) return false;
  const key = mutation.options.mutationKey;
  if (!key) return false;
  return PERSISTED.some((k) => k.length === key.length && k.every((part, i) => part === key[i]));
}
