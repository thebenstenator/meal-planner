import { resolveOrCreateCanonical } from '@/features/ingredients/resolve';
import { deduceCategory } from '@/features/shopping-list/categories';
import { fetchIngredientCategories } from '@/features/shopping-list/categories-api';
import { buildShoppingItems } from '@/features/shopping-list/generate';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';
import type { Unit } from '@/lib/ingredients';

export { listKeys } from '@/features/shopping-list/keys';

export interface ShoppingListSummary {
  id: string;
  name: string;
  status: string;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  generatedAt: string;
  createdAt: string;
  isRunning: boolean;
}

export interface ItemPurchase {
  packages: number;
  packageQuantity: number;
  packageUnit: string;
  totalPurchaseQuantity: number;
}

export interface ItemSource {
  recipeTitle: string | null;
  contributedQuantity: number | null;
}

export interface ShoppingItem {
  id: string;
  canonicalId: string | null;
  adHocName: string | null;
  displayName: string;
  totalQuantity: number | null;
  unit: string | null;
  category: string | null;
  unresolved: boolean;
  subTotals: Array<{ quantity: number; unit: Unit }> | null;
  purchase: ItemPurchase | null;
  noQuantityCount: number;
  /** How much of the need was already covered by the pantry (in `unit`), if any. */
  pantryOffsetQuantity: number | null;
  isChecked: boolean;
  /** Actual price paid, captured at check-off; null = use the estimate. */
  actualCostCents: number | null;
  isManual: boolean;
  position: number;
  sources: ItemSource[];
}

export async function listShoppingLists(householdId: string): Promise<ShoppingListSummary[]> {
  const { data, error } = await supabase
    .from('shopping_list')
    .select('id, name, status, date_range_start, date_range_end, generated_at, created_at, is_running')
    .eq('household_id', householdId)
    // Stable left-to-right tab order: oldest list first, so tabs don't reshuffle
    // when you generate into one (which bumps generated_at).
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    status: l.status,
    dateRangeStart: l.date_range_start,
    dateRangeEnd: l.date_range_end,
    generatedAt: l.generated_at,
    createdAt: l.created_at,
    isRunning: l.is_running,
  }));
}

/** Create a new standing list (a store/custom tab) you can jot into. */
export async function createShoppingList(householdId: string, name: string): Promise<string> {
  const { data, error } = await supabase
    .from('shopping_list')
    .insert({ household_id: householdId, name: name.trim() || 'New list', is_running: true })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function renameShoppingList(listId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('shopping_list')
    .update({ name: name.trim() || 'List' })
    .eq('id', listId);
  if (error) throw error;
}

/**
 * The household's standing "running" list, created on first use. There's at most
 * one (enforced by a partial unique index), so a race just returns the existing
 * one. Jotted-down items live here, independent of the meal plan.
 */
export async function getOrCreateRunningList(householdId: string): Promise<string> {
  const { data: existing, error } = await supabase
    .from('shopping_list')
    .select('id')
    .eq('household_id', householdId)
    .eq('is_running', true)
    .limit(1);
  if (error) throw error;
  const found = existing?.[0];
  if (found) return found.id;

  const { data, error: insErr } = await supabase
    .from('shopping_list')
    .insert({ household_id: householdId, name: 'Things we need', is_running: true })
    .select('id')
    .single();
  // A concurrent create loses the unique-index race — fetch the winner instead.
  if (insErr) {
    const { data: winner } = await supabase
      .from('shopping_list')
      .select('id')
      .eq('household_id', householdId)
      .eq('is_running', true)
      .limit(1);
    const winnerRow = winner?.[0];
    if (winnerRow) return winnerRow.id;
    throw insErr;
  }
  return data.id;
}

export interface CheckedItem {
  canonicalId: string | null;
  quantity: number | null;
  unit: string | null;
  actualCostCents: number | null;
}

/**
 * Checked-off (bought) items across shopping lists whose date range overlaps the
 * given month — the raw material for actual-spend tracking. Lists without a date
 * range are excluded (their month is ambiguous).
 */
export async function fetchMonthCheckedItems(
  householdId: string,
  monthStart: string,
  monthEnd: string,
): Promise<CheckedItem[]> {
  const { data: lists, error } = await supabase
    .from('shopping_list')
    .select('id')
    .eq('household_id', householdId)
    .lte('date_range_start', monthEnd)
    .gte('date_range_end', monthStart);
  if (error) throw error;
  const ids = (lists ?? []).map((l) => l.id);
  if (ids.length === 0) return [];

  const { data: items, error: itemErr } = await supabase
    .from('shopping_list_item')
    .select('canonical_ingredient_id, total_quantity, unit, actual_cost_cents')
    .in('shopping_list_id', ids)
    .eq('is_checked', true);
  if (itemErr) throw itemErr;

  return (items ?? []).map((i) => ({
    canonicalId: i.canonical_ingredient_id,
    quantity: i.total_quantity,
    unit: i.unit,
    actualCostCents: i.actual_cost_cents,
  }));
}

export interface CheckedItemWithMonth extends CheckedItem {
  /** yyyy-MM the item's list belongs to (by its date-range start). */
  month: string;
}

/**
 * Checked-off items across all lists whose date range overlaps [rangeStart,
 * rangeEnd], each tagged with its list's month — for month-over-month history.
 */
export async function fetchCheckedItemsByMonth(
  householdId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<CheckedItemWithMonth[]> {
  const { data: lists, error } = await supabase
    .from('shopping_list')
    .select('id, date_range_start')
    .eq('household_id', householdId)
    .not('date_range_start', 'is', null)
    .lte('date_range_start', rangeEnd)
    .gte('date_range_end', rangeStart);
  if (error) throw error;

  const monthByList = new Map<string, string>();
  for (const l of lists ?? []) {
    if (l.date_range_start) monthByList.set(l.id, l.date_range_start.slice(0, 7));
  }
  const ids = [...monthByList.keys()];
  if (ids.length === 0) return [];

  const { data: items, error: itemErr } = await supabase
    .from('shopping_list_item')
    .select('canonical_ingredient_id, total_quantity, unit, actual_cost_cents, shopping_list_id')
    .in('shopping_list_id', ids)
    .eq('is_checked', true);
  if (itemErr) throw itemErr;

  return (items ?? []).map((i) => ({
    canonicalId: i.canonical_ingredient_id,
    quantity: i.total_quantity,
    unit: i.unit,
    actualCostCents: i.actual_cost_cents,
    month: monthByList.get(i.shopping_list_id) ?? '',
  }));
}

export async function getShoppingList(
  listId: string,
): Promise<{ summary: ShoppingListSummary; items: ShoppingItem[] }> {
  const { data, error } = await supabase
    .from('shopping_list')
    .select(
      'id, name, status, date_range_start, date_range_end, generated_at, created_at, is_running, shopping_list_item(*, shopping_list_item_source(contributed_quantity, recipe_ingredient(recipe(title))))',
    )
    .eq('id', listId)
    .order('position', { referencedTable: 'shopping_list_item', ascending: true })
    .single();
  if (error) throw error;

  const items: ShoppingItem[] = (data.shopping_list_item ?? []).map((i) => ({
    id: i.id,
    canonicalId: i.canonical_ingredient_id,
    adHocName: i.ad_hoc_name,
    displayName: i.display_name,
    totalQuantity: i.total_quantity,
    unit: i.unit,
    category: i.category,
    unresolved: i.unresolved,
    subTotals: (i.sub_totals as ShoppingItem['subTotals']) ?? null,
    purchase: (i.purchase as ItemPurchase | null) ?? null,
    noQuantityCount: i.no_quantity_count,
    pantryOffsetQuantity: i.pantry_offset_quantity != null ? Number(i.pantry_offset_quantity) : null,
    isChecked: i.is_checked,
    actualCostCents: i.actual_cost_cents,
    isManual: i.is_manual,
    position: i.position,
    sources: (i.shopping_list_item_source ?? []).map((s) => ({
      recipeTitle: s.recipe_ingredient?.recipe?.title ?? null,
      contributedQuantity: s.contributed_quantity,
    })),
  }));

  return {
    summary: {
      id: data.id,
      name: data.name,
      status: data.status,
      dateRangeStart: data.date_range_start,
      dateRangeEnd: data.date_range_end,
      generatedAt: data.generated_at,
      createdAt: data.created_at,
      isRunning: data.is_running,
    },
    items,
  };
}

export async function generateList(
  householdId: string,
  opts: { name: string; start: string; end: string; listId?: string; subtractPantry?: boolean },
): Promise<string> {
  const items = await buildShoppingItems(
    householdId,
    opts.start,
    opts.end,
    opts.subtractPantry ?? true,
  );
  const { data, error } = await supabase.rpc('generate_shopping_list', {
    p_household_id: householdId,
    p_name: opts.name,
    p_start: opts.start,
    p_end: opts.end,
    p_items: items as unknown as Json,
    p_list_id: opts.listId,
  });
  if (error) throw error;
  return data as string;
}

export async function setItemChecked(itemId: string, checked: boolean): Promise<void> {
  const { error } = await supabase
    .from('shopping_list_item')
    .update({ is_checked: checked })
    .eq('id', itemId);
  if (error) throw error;
}

/** Record (or clear, with null) the actual price paid for an item. */
export async function setItemActualCost(itemId: string, cents: number | null): Promise<void> {
  const { error } = await supabase
    .from('shopping_list_item')
    .update({ actual_cost_cents: cents })
    .eq('id', itemId);
  if (error) throw error;
}

export async function deleteShoppingList(listId: string): Promise<void> {
  const { error } = await supabase.from('shopping_list').delete().eq('id', listId);
  if (error) throw error;
}

/**
 * Clear every checked-off item from a list — the end-of-trip cleanup, leaving
 * behind only what you still need.
 *
 * This is destructive and the checked items are the only record of what was
 * bought, so callers should log the trip first (see the finish-trip flow).
 */
export async function clearCheckedItems(listId: string): Promise<void> {
  const { error } = await supabase
    .from('shopping_list_item')
    .delete()
    .eq('shopping_list_id', listId)
    .eq('is_checked', true);
  if (error) throw error;
}

/**
 * Add a manual item ("paper towels") that survives regeneration. Its category is
 * deduced from the name, falling back to "other".
 */
export async function addAdHocItem(
  listId: string,
  input: { name: string; quantity: number | null; unit: string | null; category?: string },
): Promise<void> {
  const { error } = await supabase.from('shopping_list_item').insert({
    shopping_list_id: listId,
    ad_hoc_name: input.name,
    display_name: input.name,
    total_quantity: input.quantity,
    unit: input.unit,
    category: input.category ?? deduceCategory(input.name),
    is_manual: true,
  });
  if (error) throw error;
}

export type SmartAddResult = 'added' | 'exists';

/**
 * Add a jotted item the smart way: resolve the typed name to a canonical
 * ingredient (creating one if new), so it groups by aisle, gets priced from your
 * store, and lands in the pantry when checked off. Deduplicates against anything
 * already on the list for that ingredient. Falls back to a plain ad-hoc row if
 * the name can't be resolved.
 */
export async function addSmartItem(
  householdId: string,
  listId: string,
  input: { name: string; quantity: number | null; unit: string | null },
): Promise<SmartAddResult> {
  const resolved = await resolveOrCreateCanonical(householdId, input.name).catch(() => null);

  if (!resolved) {
    await addAdHocItem(listId, input);
    return 'added';
  }

  // Already on this list for the same ingredient — don't add a duplicate row.
  const { data: existing, error: exErr } = await supabase
    .from('shopping_list_item')
    .select('id')
    .eq('shopping_list_id', listId)
    .eq('canonical_ingredient_id', resolved.canonicalId)
    .limit(1);
  if (exErr) throw exErr;
  if (existing && existing.length > 0) return 'exists';

  // Category, most specific first: what this household filed the ingredient
  // under, then the ingredient's own category, then a guess from the name.
  const [{ data: canon }, overrides] = await Promise.all([
    supabase.from('canonical_ingredient').select('category').eq('id', resolved.canonicalId).single(),
    fetchIngredientCategories(householdId, [resolved.canonicalId]).catch(
      (): Record<string, string> => ({}),
    ),
  ]);

  const { error } = await supabase.from('shopping_list_item').insert({
    shopping_list_id: listId,
    canonical_ingredient_id: resolved.canonicalId,
    display_name: resolved.name,
    total_quantity: input.quantity,
    unit: input.unit,
    category:
      overrides[resolved.canonicalId] ?? canon?.category ?? deduceCategory(resolved.name),
    is_manual: true,
  });
  if (error) throw error;
  return 'added';
}

/**
 * File an item under a category. Remembering it for the ingredient (so the
 * choice survives regeneration and applies next time) is a separate,
 * best-effort step — see `setIngredientCategory`.
 */
export async function setItemCategory(itemId: string, category: string): Promise<void> {
  const { error } = await supabase
    .from('shopping_list_item')
    .update({ category })
    .eq('id', itemId);
  if (error) throw error;
}

/** Manual override of an item's quantity/unit (lasts until regeneration). */
export async function updateItemQuantity(
  itemId: string,
  patch: { totalQuantity: number | null; unit: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('shopping_list_item')
    .update({ total_quantity: patch.totalQuantity, unit: patch.unit })
    .eq('id', itemId);
  if (error) throw error;
}

export async function deleteItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('shopping_list_item').delete().eq('id', itemId);
  if (error) throw error;
}

/**
 * Write a conversion fact back to the canonical ingredient so future
 * consolidations merge (specs/05: "the system gets smarter with use"). Only
 * household-owned canonical rows are writable (RLS); global rows already ship
 * with densities.
 */
export async function setCanonicalConversion(
  canonicalId: string,
  patch: { densityGPerMl?: number; countToGram?: number },
): Promise<void> {
  const update: { density_g_per_ml?: number; count_to_gram?: number } = {};
  if (patch.densityGPerMl != null) update.density_g_per_ml = patch.densityGPerMl;
  if (patch.countToGram != null) update.count_to_gram = patch.countToGram;
  const { error } = await supabase
    .from('canonical_ingredient')
    .update(update)
    .eq('id', canonicalId);
  if (error) throw error;
}
