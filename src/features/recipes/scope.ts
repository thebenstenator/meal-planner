import type { RecipeSummary } from '@/features/recipes/api';

/**
 * Where a recipe lives. A recipe always sits in the household that created it,
 * and additionally in every pool it's shared into — so these scopes overlap on
 * purpose. They're places to look, not exclusive buckets, which is why "all"
 * stays available as the way to search across the lot.
 */
export type RecipeScope = { kind: 'all' } | { kind: 'household' } | { kind: 'pool'; poolId: string };

/** Just the placement fields, so callers can pass a summary or a detail. */
type Placed = Pick<RecipeSummary, 'ownedByMe' | 'poolIds'>;

/** Stable string for React keys and active-tab comparison. */
export function scopeKey(scope: RecipeScope): string {
  return scope.kind === 'pool' ? `pool:${scope.poolId}` : scope.kind;
}

export function matchesScope(recipe: Placed, scope: RecipeScope): boolean {
  switch (scope.kind) {
    case 'all':
      return true;
    case 'household':
      return recipe.ownedByMe;
    case 'pool':
      return recipe.poolIds.includes(scope.poolId);
  }
}

export interface ScopeCounts {
  all: number;
  household: number;
  /** Keyed by pool id; every id passed in gets an entry, even at zero. */
  pools: Record<string, number>;
}

/** How many recipes each tab would show, for the counts on the labels. */
export function scopeCounts(recipes: Placed[], poolIds: string[]): ScopeCounts {
  const pools: Record<string, number> = {};
  for (const id of poolIds) pools[id] = 0;

  let household = 0;
  for (const recipe of recipes) {
    if (recipe.ownedByMe) household += 1;
    for (const id of recipe.poolIds) {
      // Pools we're no longer in can still be on a recipe we own; skip them
      // rather than inventing a tab for a pool the user can't see.
      const current = pools[id];
      if (current !== undefined) pools[id] = current + 1;
    }
  }

  return { all: recipes.length, household, pools };
}
