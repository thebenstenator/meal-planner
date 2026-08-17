import { dehydrate, hydrate, QueryClient, type MutationKey } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  offlineMutationKeys,
  registerOfflineMutations,
  shouldPersistMutation,
} from '@/lib/query/offline-mutations';

const setItemChecked = vi.fn<(itemId: string, checked: boolean) => Promise<void>>();

vi.mock('@/features/shopping-list/api', () => ({
  setItemChecked: (itemId: string, checked: boolean) => setItemChecked(itemId, checked),
  setItemActualCost: vi.fn(async () => {}),
}));

function client(): QueryClient {
  const qc = new QueryClient();
  registerOfflineMutations(qc);
  return qc;
}

/**
 * A write sitting in the cache exactly as the persister would find it: paused
 * mid-flight, with its variables but nothing else.
 */
function queuedWrite(
  qc: QueryClient,
  opts: { mutationKey?: MutationKey; isPaused?: boolean; variables?: unknown } = {},
) {
  const { mutationKey, isPaused = true, variables } = opts;
  return qc.getMutationCache().build<unknown, Error, unknown, unknown>(
    qc,
    { mutationKey, mutationFn: async () => {} },
    {
      context: undefined,
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isPaused,
      status: isPaused ? 'pending' : 'success',
      submittedAt: Date.now(),
      variables,
    },
  );
}

const checkOff = { itemId: 'item-1', checked: true };

describe('shouldPersistMutation', () => {
  it('keeps a paused write we know how to revive', () => {
    const qc = client();
    const m = queuedWrite(qc, {
      mutationKey: offlineMutationKeys.toggleItem,
      variables: checkOff,
    });
    expect(shouldPersistMutation(m)).toBe(true);
  });

  it('drops a paused write with no key — it would come back unrunnable', () => {
    expect(shouldPersistMutation(queuedWrite(client()))).toBe(false);
  });

  it('drops a keyed write that is not on the offline list', () => {
    // e.g. the receipt scan: replaying it blind would spend an AI credit.
    const m = queuedWrite(client(), { mutationKey: ['receipt', 'scan'] });
    expect(shouldPersistMutation(m)).toBe(false);
  });

  it('ignores a write that already went through', () => {
    const m = queuedWrite(client(), {
      mutationKey: offlineMutationKeys.toggleItem,
      isPaused: false,
    });
    expect(shouldPersistMutation(m)).toBe(false);
  });
});

describe('a check-off queued offline', () => {
  beforeEach(() => setItemChecked.mockClear());

  function reload(from: QueryClient, into: QueryClient): void {
    // JSON is the part that bites: a mutationFn is a closure and does not
    // survive it, so what comes back has nothing to call.
    const wire = JSON.parse(
      JSON.stringify(dehydrate(from, { shouldDehydrateMutation: shouldPersistMutation })),
    ) as unknown;
    hydrate(into, wire);
  }

  // The bug this exists for: a restored write dies on resume with no
  // mutationFn, while its optimistic update — which *does* persist — sits there
  // looking like it succeeded. A mutationKey with a registered default is the
  // only thing reconnecting the two.
  it('survives a reload and still reaches the server', async () => {
    const before = client();
    queuedWrite(before, { mutationKey: offlineMutationKeys.toggleItem, variables: checkOff });

    const after = client();
    reload(before, after);
    await after.resumePausedMutations();

    expect(setItemChecked).toHaveBeenCalledWith('item-1', true);
  });

  it('reaches nothing without the registered default — the old behaviour', async () => {
    const before = client();
    queuedWrite(before, { mutationKey: offlineMutationKeys.toggleItem, variables: checkOff });

    // Same payload, into a client that never registered the defaults.
    const after = new QueryClient();
    reload(before, after);
    await after.resumePausedMutations().catch(() => {});

    expect(setItemChecked).not.toHaveBeenCalled();
  });
});
