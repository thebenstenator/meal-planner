import {
  DEFAULT_CATEGORIES,
  FALLBACK_CATEGORY,
  POSITION_STEP,
  slugifyCategory,
  type ShoppingCategory,
} from '@/features/shopping-list/categories';
import { supabase } from '@/lib/supabase/client';

export const categoryKeys = {
  all: (householdId: string) => ['shopping-categories', householdId] as const,
};

const SELECT = 'id, slug, name, position, is_fallback';

type Row = {
  id: string;
  slug: string;
  name: string;
  position: number;
  is_fallback: boolean;
};

function fromRow(r: Row): ShoppingCategory {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    position: r.position,
    isFallback: r.is_fallback,
  };
}

/**
 * The household's categories in aisle order. New households are seeded by a
 * trigger; if a household somehow has none (an import, a wiped table), the
 * defaults are written on first read so the list is never uncategorizable.
 */
export async function listCategories(householdId: string): Promise<ShoppingCategory[]> {
  const rows = await selectCategories(householdId);
  if (rows.length > 0) return rows;

  const { error } = await supabase.from('shopping_category').upsert(
    DEFAULT_CATEGORIES.map((c) => ({
      household_id: householdId,
      slug: c.slug,
      name: c.name,
      position: c.position,
      is_fallback: c.isFallback,
    })),
    { onConflict: 'household_id,slug', ignoreDuplicates: true },
  );
  if (error) throw error;
  return selectCategories(householdId);
}

async function selectCategories(householdId: string): Promise<ShoppingCategory[]> {
  const { data, error } = await supabase
    .from('shopping_category')
    .select(SELECT)
    .eq('household_id', householdId)
    .order('position', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export class DuplicateCategoryError extends Error {
  constructor(
    public readonly slug: string,
    name: string,
  ) {
    super(`You already have a category for “${name}”.`);
    this.name = 'DuplicateCategoryError';
  }
}

/**
 * Add a category, slotted at the end of the shopping order (before the fallback
 * bucket). Returns its slug so the caller can file an item under it right away.
 */
export async function createCategory(
  householdId: string,
  name: string,
  existing: ShoppingCategory[],
): Promise<ShoppingCategory> {
  const trimmed = name.trim();
  const slug = slugifyCategory(trimmed);
  if (slug === '') throw new Error('Give the category a name.');
  if (existing.some((c) => c.slug === slug))
    throw new DuplicateCategoryError(slug, trimmed);

  const lastSortable = existing
    .filter((c) => !c.isFallback)
    .reduce((max, c) => Math.max(max, c.position), 0);

  const { data, error } = await supabase
    .from('shopping_category')
    .insert({
      household_id: householdId,
      slug,
      name: trimmed,
      position: lastSortable + POSITION_STEP,
      is_fallback: false,
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function renameCategory(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed === '') throw new Error('Give the category a name.');
  const { error } = await supabase
    .from('shopping_category')
    .update({ name: trimmed })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Delete a category. The RPC moves everything filed under it to the fallback
 * bucket first, so no item is left pointing at a category that's gone.
 */
export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_shopping_category', {
    p_id: id,
    p_reassign_to: FALLBACK_CATEGORY,
  });
  if (error) throw error;
}

/** Persist a new aisle order (positions come from `moveCategory`). */
export async function saveCategoryOrder(
  householdId: string,
  categories: ShoppingCategory[],
): Promise<void> {
  const { error } = await supabase.from('shopping_category').upsert(
    categories.map((c) => ({
      id: c.id,
      household_id: householdId,
      slug: c.slug,
      name: c.name,
      position: c.position,
      is_fallback: c.isFallback,
    })),
    { onConflict: 'id' },
  );
  if (error) throw error;
}

/**
 * Remember that this household files an ingredient under a category ("eggs go
 * in dairy for us"). Applied when items are added and when a list is
 * regenerated, so a recategorized item stays where it was put — including for
 * global seed ingredients, which RLS keeps read-only.
 */
export async function setIngredientCategory(
  householdId: string,
  canonicalIngredientId: string,
  category: string,
): Promise<void> {
  const { error } = await supabase.from('household_ingredient_category').upsert(
    {
      household_id: householdId,
      canonical_ingredient_id: canonicalIngredientId,
      category,
    },
    { onConflict: 'household_id,canonical_ingredient_id' },
  );
  if (error) throw error;
}

/**
 * The household's ingredient → category overrides, keyed by canonical id.
 *
 * A plain object, not a Map. Nothing uses this as a queryFn today, but two
 * Map-returning fetchers that *were* used as one shipped a crash to production
 * (they persist to localStorage as `{}`, whose `.get` throws — see the v5 note
 * in lib/query/persister.ts). The rule only holds if it holds everywhere, so no
 * async fetcher here returns a Map, wired into a query or not.
 */
export async function fetchIngredientCategories(
  householdId: string,
  canonicalIds?: string[],
): Promise<Record<string, string>> {
  if (canonicalIds && canonicalIds.length === 0) return {};
  let query = supabase
    .from('household_ingredient_category')
    .select('canonical_ingredient_id, category')
    .eq('household_id', householdId);
  if (canonicalIds) query = query.in('canonical_ingredient_id', canonicalIds);

  const { data, error } = await query;
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.canonical_ingredient_id, r.category]));
}
