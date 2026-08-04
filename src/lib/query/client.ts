import { QueryClient } from '@tanstack/react-query';

/**
 * Single QueryClient for the app. All server state flows through TanStack Query
 * (10-conventions.md: "No useEffect + fetch"). Query keys are structured arrays
 * scoped by householdId, e.g. ['recipes', householdId, filters].
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // Keep cached data around long enough to survive an offline reload; the
      // persister (see lib/query/persister) mirrors it to storage. gcTime must
      // be >= the persister maxAge or entries get evicted before restore.
      gcTime: 1000 * 60 * 60 * 24, // 24h
    },
  },
});
