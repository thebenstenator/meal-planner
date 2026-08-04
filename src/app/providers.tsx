import { RouterProvider } from '@tanstack/react-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { router } from '@/app/router';
import { AuthProvider } from '@/features/auth/auth-context';
import { queryClient } from '@/lib/query/client';
import { CACHE_MAX_AGE, queryPersister } from '@/lib/query/persister';

/** App-wide providers wrapping the router. */
export function AppProviders() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: CACHE_MAX_AGE }}
      onSuccess={() => {
        // Once the cache is restored, replay any mutations queued while offline
        // (e.g. check-offs done in the grocery aisle).
        void queryClient.resumePausedMutations();
      }}
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
