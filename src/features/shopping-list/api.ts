import { buildShoppingItems } from '@/features/shopping-list/generate';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/supabase/database.types';
import type { Unit } from '@/lib/ingredients';

export const listKeys = {
  all: (householdId: string) => ['shopping-lists', householdId] as const,
  detail: (id: string) => ['shopping-list', id] as const,
};

export interface ShoppingListSummary {
  id: string;
  name: string;
  status: string;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  generatedAt: string;
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
    .select('id, name, status, date_range_start, date_range_end, generated_at')
    .eq('household_id', householdId)
    .order('generated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    status: l.status,
    dateRangeStart: l.date_range_start,
    dateRangeEnd: l.date_range_end,
    generatedAt: l.generated_at,
  }));
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
      'id, name, status, date_range_start, date_range_end, generated_at, shopping_list_item(*, shopping_list_item_source(contributed_quantity, recipe_ingredient(recipe(title))))',
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
    },
    items,
  };
}

export async function generateList(
  householdId: string,
  opts: { name: string; start: string; end: string; listId?: string },
): Promise<string> {
  const items = await buildShoppingItems(householdId, opts.start, opts.end);
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

/** Add a manual item ("paper towels") that survives regeneration. */
export async function addAdHocItem(
  listId: string,
  input: { name: string; quantity: number | null; unit: string | null },
): Promise<void> {
  const { error } = await supabase.from('shopping_list_item').insert({
    shopping_list_id: listId,
    ad_hoc_name: input.name,
    display_name: input.name,
    total_quantity: input.quantity,
    unit: input.unit,
    category: 'other',
    is_manual: true,
  });
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
