import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * Persists the TanStack Query cache to localStorage so the active shopping list,
 * recipes, and plan are readable offline and survive a reload (specs/07 Slice 8:
 * offline-first). One store; keyed by our structured query keys.
 */
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24h

export const queryPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  // v2: query data must be JSON-serializable (no Maps — they round-trip to `{}`).
  // Bumping the key discards any older, incompatible cache on next load.
  key: 'mealplan-query-cache-v2',
});
