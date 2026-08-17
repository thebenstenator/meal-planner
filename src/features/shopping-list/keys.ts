/**
 * Query keys for shopping lists, in their own module so that importing a key
 * doesn't drag in `shopping-list/api` — which pulls the ingredient engine, and
 * with it ~30kB into whatever chunk touches it. Re-exported from `api.ts`, so
 * `import { listKeys } from '.../api'` keeps working.
 */
export const listKeys = {
  all: (householdId: string) => ['shopping-lists', householdId] as const,
  detail: (id: string) => ['shopping-list', id] as const,
  /** Prefix matching every list's contents — for changes that can affect any of them. */
  allDetails: () => ['shopping-list'] as const,
};
