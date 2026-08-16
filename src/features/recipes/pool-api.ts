import { supabase } from '@/lib/supabase/client';

/** Query keys for the recipe pools a household belongs to. */
export const poolKeys = {
  mine: (householdId: string) => ['recipe-pool', householdId] as const,
  members: (poolId: string) => ['recipe-pool-members', poolId] as const,
};

export interface RecipePool {
  id: string;
  name: string;
  ownerHouseholdId: string;
  /** The current household's role in this pool. */
  role: 'owner' | 'member';
}

export interface PoolMemberRow {
  householdId: string;
  householdName: string;
  role: 'owner' | 'member';
  joinedAt: string;
  /** Owner-user's email, for a recognizable label. */
  email: string | null;
}

export interface PoolInviteResult {
  code: string;
  expiresAt: string;
}

/**
 * Every pool a household belongs to — the ones it started and the ones it
 * joined — oldest first. A household can be in as many as it likes (family,
 * friends, a supper club), and each recipe picks which of them it goes into.
 */
export async function fetchMyPools(householdId: string): Promise<RecipePool[]> {
  const { data, error } = await supabase
    .from('recipe_pool_member')
    .select('role, pool:pool_id (id, name, owner_household_id)')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true });
  if (error) throw error;

  return (data ?? [])
    .filter((m): m is typeof m & { pool: NonNullable<typeof m.pool> } => m.pool != null)
    .map((m) => ({
      id: m.pool.id,
      name: m.pool.name,
      ownerHouseholdId: m.pool.owner_household_id,
      role: m.role as 'owner' | 'member',
    }));
}

/** Create a pool from this household and share its whole library into it. */
export async function createPool(householdId: string, name: string): Promise<RecipePool> {
  const { data, error } = await supabase.rpc('create_recipe_pool', {
    p_household_id: householdId,
    p_name: name,
  });
  if (error) throw error;
  if (!data) throw new Error('No pool returned');
  return {
    id: data.id,
    name: data.name,
    ownerHouseholdId: data.owner_household_id,
    role: 'owner',
  };
}

/** Member households of a pool, via the guarded RPC. */
export async function fetchPoolMembers(poolId: string): Promise<PoolMemberRow[]> {
  const { data, error } = await supabase.rpc('get_recipe_pool_members', {
    p_pool_id: poolId,
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

export async function createPoolInvite(poolId: string): Promise<PoolInviteResult> {
  const { data, error } = await supabase.rpc('create_recipe_pool_invite', {
    p_pool_id: poolId,
  });
  if (error) throw error;
  if (!data) throw new Error('No invite returned');
  return { code: data.code, expiresAt: data.expires_at };
}

/** Accept an invite by code; returns the joined pool id. */
export async function acceptPoolInvite(householdId: string, code: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_recipe_pool_invite', {
    p_household_id: householdId,
    p_code: code,
  });
  if (error) throw error;
  return data as string;
}

/** Leave a pool (members only; the owner deletes the pool instead). */
export async function leavePool(householdId: string, poolId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_recipe_pool', {
    p_household_id: householdId,
    p_pool_id: poolId,
  });
  if (error) throw error;
}

/** Delete the pool (owner only); its recipes fall back to private. */
export async function deletePool(poolId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_recipe_pool', { p_pool_id: poolId });
  if (error) throw error;
}

/**
 * Set exactly which pools a recipe is shared into (replacing whatever it was).
 * Only the household that added the recipe can do this — RLS on
 * recipe_pool_share enforces it, so passing someone else's pools is a no-op
 * rather than an error.
 */
export async function setRecipePools(recipeId: string, poolIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_recipe_pools', {
    p_recipe_id: recipeId,
    p_pool_ids: poolIds,
  });
  if (error) throw error;
}

/**
 * Drop one recipe out of one pool. The creator uses this to unshare; a pool
 * owner uses it to evict someone else's recipe from the pool they run — that
 * eviction is the owner's only power over recipes they didn't add.
 */
export async function unshareRecipeFromPool(recipeId: string, poolId: string): Promise<void> {
  const { error } = await supabase
    .from('recipe_pool_share')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('pool_id', poolId);
  if (error) throw error;
}
