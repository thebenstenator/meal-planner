// Client-side mirror of the recipe RLS rules (see 20260815120000_recipe_pools.sql).
// The database is the real guard; these just keep dead buttons off the screen so
// a member never clicks "Delete" only to get a 42501 back.

export interface MyPool {
  id: string;
  role: 'owner' | 'member';
}

export interface RecipePerm {
  /** The active household created this recipe. */
  ownedByMe: boolean;
  /** The recipe's pool, or null if it's private. */
  recipePoolId: string | null;
  /** The active household's pool (own or joined), or null. */
  myPool: MyPool | null;
}

/** True when the active household is the owner of the recipe's pool. */
function ownsRecipePool({ recipePoolId, myPool }: RecipePerm): boolean {
  return recipePoolId != null && myPool?.id === recipePoolId && myPool.role === 'owner';
}

/** Creators edit their own recipes; the pool owner edits anything in the pool. */
export function canEditRecipe(p: RecipePerm): boolean {
  return p.ownedByMe || ownsRecipePool(p);
}

/** Only the pool owner deletes pool recipes; private recipes, their creator. */
export function canDeleteRecipe(p: RecipePerm): boolean {
  return p.recipePoolId != null ? ownsRecipePool(p) : p.ownedByMe;
}

/** Favorites/ratings are per-creator (v1): only touch recipes you added. */
export function canFavoriteRecipe(p: RecipePerm): boolean {
  return p.ownedByMe;
}
