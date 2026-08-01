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
    },
  },
});
