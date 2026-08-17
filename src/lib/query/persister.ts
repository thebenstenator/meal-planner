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
  //   v4: pool → cookbook rename — `poolIds` became `cookbookIds` and the query
  //       keys changed (['cookbook', …]); a v3 cache would feed the old field
  //       names into the new code and crash the same way.
  //   v5: the v2 rule got broken twice — ['pantry-prefs', …] and
  //       ['canonical-names', …] both cached Maps, which persisted as `{}` and
  //       then threw "prefs.get is not a function" on the shopping list and
  //       stores pages. Both are plain objects now; this discards the poisoned
  //       caches, which a reload alone could never do (localStorage survives
  //       refresh, app restart, and service-worker updates alike).
  key: 'mealplan-query-cache-v5',
});
