import { supabase } from '@/lib/supabase/client';

// "Cookbook" is the product name for a shared recipe pool. The database still
// calls these `recipe_pool*` tables / `create_recipe_pool` RPCs / `pool_id`
// columns — that legacy schema name is deliberately kept, so every Supabase
// string below stays `pool` while the TypeScript surface reads `cookbook`.

/** Query keys for the cookbooks a household belongs to. */
export const cookbookKeys = {
  mine: (householdId: string) => ['cookbook', householdId] as const,
  members: (cookbookId: string) => ['cookbook-members', cookbookId] as const,
  /** Deliberately under the 'recipes' prefix: share counts go stale whenever a
   * recipe is saved, deleted or re-shared, and those all invalidate ['recipes']
   * already. Hanging it off the cookbook prefix would miss every one of them. */
  myShares: (householdId: string) => ['recipes', householdId, 'cookbook-shares'] as const,
};

export interface Cookbook {
  id: string;
  name: string;
  ownerHouseholdId: string;
  /** The current household's role in this cookbook. */
  role: 'owner' | 'member';
}

export interface CookbookMemberRow {
  householdId: string;
  householdName: string;
  role: 'owner' | 'member';
  joinedAt: string;
  /** Owner-user's email, for a recognizable label. */
  email: string | null;
}

export interface CookbookInviteResult {
  code: string;
  expiresAt: string;
}

/**
 * Every cookbook a household belongs to — the ones it started and the ones it
 * joined — oldest first. A household can be in as many as it likes (family,
 * friends, a supper club), and each recipe picks which of them it goes into.
 */
export async function fetchMyCookbooks(householdId: string): Promise<Cookbook[]> {
  const { data, error } = await supabase
    .from('recipe_pool_member')
    .select('role, cookbook:pool_id (id, name, owner_household_id)')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true });
  if (error) throw error;

  return (data ?? [])
    .filter((m): m is typeof m & { cookbook: NonNullable<typeof m.cookbook> } => m.cookbook != null)
    .map((m) => ({
      id: m.cookbook.id,
      name: m.cookbook.name,
      ownerHouseholdId: m.cookbook.owner_household_id,
      role: m.role as 'owner' | 'member',
    }));
}

/** Create a cookbook from this household and share its whole library into it. */
export async function createCookbook(householdId: string, name: string): Promise<Cookbook> {
  const { data, error } = await supabase.rpc('create_recipe_pool', {
    p_household_id: householdId,
    p_name: name,
  });
  if (error) throw error;
  if (!data) throw new Error('No cookbook returned');
  return {
    id: data.id,
    name: data.name,
    ownerHouseholdId: data.owner_household_id,
    role: 'owner',
  };
}

/** Member households of a cookbook, via the guarded RPC. */
export async function fetchCookbookMembers(cookbookId: string): Promise<CookbookMemberRow[]> {
  const { data, error } = await supabase.rpc('get_recipe_pool_members', {
    p_pool_id: cookbookId,
  });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    householdId: m.household_id,
    householdName: m.household_name,
    role: m.role as 'owner' | 'member',
    joinedAt: m.joined_at,
    email: m.email,
  }));
}

export async function createCookbookInvite(cookbookId: string): Promise<CookbookInviteResult> {
  const { data, error } = await supabase.rpc('create_recipe_pool_invite', {
    p_pool_id: cookbookId,
  });
  if (error) throw error;
  if (!data) throw new Error('No invite returned');
  return { code: data.code, expiresAt: data.expires_at };
}

/** Accept an invite by code; returns the joined cookbook id. */
export async function acceptCookbookInvite(householdId: string, code: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_recipe_pool_invite', {
    p_household_id: householdId,
    p_code: code,
  });
  if (error) throw error;
  return data as string;
}

/** Leave a cookbook (members only; the owner deletes the cookbook instead). */
export async function leaveCookbook(householdId: string, cookbookId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_recipe_pool', {
    p_household_id: householdId,
    p_pool_id: cookbookId,
  });
  if (error) throw error;
}

/** Delete the cookbook (owner only); its recipes fall back to private. */
export async function deleteCookbook(cookbookId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_recipe_pool', { p_pool_id: cookbookId });
  if (error) throw error;
}

/**
 * Set exactly which cookbooks a recipe is shared into (replacing whatever it
 * was). Only the household that added the recipe can do this — RLS on
 * recipe_pool_share enforces it, so passing someone else's cookbooks is a no-op
 * rather than an error.
 */
export async function setRecipeCookbooks(recipeId: string, cookbookIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_recipe_pools', {
    p_recipe_id: recipeId,
    p_pool_ids: cookbookIds,
  });
  if (error) throw error;
}

/**
 * This household's own live recipes and, for each, the cookbooks it's in. Just
 * enough to answer "how much of my library is in this cookbook?" without pulling
 * the whole library view — the cookbook cards use it to say so out loud.
 */
export async function fetchMyRecipeShares(
  householdId: string,
): Promise<{ ownedByMe: true; cookbookIds: string[] }[]> {
  const { data, error } = await supabase
    .from('recipe')
    .select('id, recipe_pool_share(pool_id)')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .limit(1000);
  if (error) throw error;

  return (data ?? []).map((r) => ({
    ownedByMe: true,
    cookbookIds: (r.recipe_pool_share ?? []).map((s) => s.pool_id),
  }));
}

/**
 * Put every recipe this household has into a cookbook it already belongs to, in
 * one statement. Creating a cookbook does this implicitly; joining one doesn't,
 * so this is how a joiner shares back. Returns how many were newly added
 * (already-shared recipes are skipped, so running it twice is harmless).
 */
export async function shareAllWithCookbook(
  householdId: string,
  cookbookId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('share_all_with_pool', {
    p_household_id: householdId,
    p_pool_id: cookbookId,
  });
  if (error) throw error;
  return data ?? 0;
}

/**
 * Drop one recipe out of one cookbook. The creator uses this to unshare; a
 * cookbook owner uses it to evict someone else's recipe from the cookbook they
 * run — that eviction is the owner's only power over recipes they didn't add.
 */
export async function unshareRecipeFromCookbook(
  recipeId: string,
  cookbookId: string,
): Promise<void> {
  const { error } = await supabase
    .from('recipe_pool_share')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('pool_id', cookbookId);
  if (error) throw error;
}
