// Client-side mirror of the recipe RLS rules (see
// 20260815190000_recipe_pool_options.sql). The database is the real guard;
// these just keep dead buttons off the screen so nobody clicks "Delete" only to
// get a 42501 back.
//
// The rule is simply: **the household that added a recipe owns it.** They edit
// it, delete it, and choose which cookbooks it's shared into. A cookbook owner
// has no say over someone else's recipe except to evict it from their cookbook.

export interface MyCookbook {
  id: string;
  role: 'owner' | 'member';
}

export interface RecipePerm {
  /** The active household created this recipe. */
  ownedByMe: boolean;
  /** Cookbooks the recipe is shared into (empty when private). */
  recipeCookbookIds: string[];
  /** Every cookbook the active household belongs to. */
  myCookbooks: MyCookbook[];
}

export function canEditRecipe(p: RecipePerm): boolean {
  return p.ownedByMe;
}

export function canDeleteRecipe(p: RecipePerm): boolean {
  return p.ownedByMe;
}

/** Favorites and ratings are per-creator: only touch recipes you added. */
export function canFavoriteRecipe(p: RecipePerm): boolean {
  return p.ownedByMe;
}

/** Only the creator picks where a recipe is shared. */
export function canManageSharing(p: RecipePerm): boolean {
  return p.ownedByMe;
}

/**
 * Cookbooks the viewer *runs* that this recipe is currently in — the ones they
 * can evict it from. Empty for your own recipes: unsharing those is part of
 * managing sharing, not moderation.
 */
export function cookbooksICanEvictFrom(p: RecipePerm): string[] {
  if (p.ownedByMe) return [];
  const ownedIds = new Set(p.myCookbooks.filter((m) => m.role === 'owner').map((m) => m.id));
  return p.recipeCookbookIds.filter((id) => ownedIds.has(id));
}
