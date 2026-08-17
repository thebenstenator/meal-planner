import { RouterProvider } from '@tanstack/react-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { router } from '@/app/router';
import { AuthProvider } from '@/features/auth/auth-context';
import { queryClient } from '@/lib/query/client';
import { registerOfflineMutations, shouldPersistMutation } from '@/lib/query/offline-mutations';
import { CACHE_MAX_AGE, queryPersister } from '@/lib/query/persister';

// Before the persister rehydrates, so a restored write finds its mutationFn.
registerOfflineMutations(queryClient);

/** App-wide providers wrapping the router. */
export function AppProviders() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: CACHE_MAX_AGE,
        // Only keep paused writes we can actually revive; the default keeps all
        // of them, including ones that come back unrunnable.
        dehydrateOptions: { shouldDehydrateMutation: shouldPersistMutation },
      }}
      onSuccess={() => {
        // Once the cache is restored, replay any mutations queued while offline
        // (e.g. check-offs done in the grocery aisle). Swallowed on failure: a
        // cache written before the keys above existed still holds writes with no
        // mutationFn to find, and losing one shouldn't surface as a crash.
        queryClient.resumePausedMutations().catch(() => {});
      }}
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
