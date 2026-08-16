import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * Persists the TanStack Query cache to localStorage so the active shopping list,
 * recipes, and plan are readable offline and survive a reload (specs/07 Slice 8:
 * offline-first). One store; keyed by our structured query keys.
 */
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24h

export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  // Bump this key whenever a persisted query's shape changes, so a client that
  // cached the old shape discards it on next load instead of rehydrating it into
  // code that expects the new one.
  //   v2: query data must be JSON-serializable (no Maps — they round-trip to `{}`).
  //   v3: recipe pools — RecipeSummary gained `poolIds`, plus the new
  //       ['recipe-pool', …] / ['recipes', …, 'pool-shares'] queries. Old caches
  //       lacked these, crashing the scope tabs with "x.map is not a function".
  key: 'mealplan-query-cache-v3',
});
