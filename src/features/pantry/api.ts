import type { ConversionInfo } from '@/features/pricing/price-item';
import { convert, type Unit } from '@/lib/ingredients';
import { supabase } from '@/lib/supabase/client';

export const pantryKeys = {
  all: (householdId: string) => ['pantry', householdId] as const,
};

export type PantryLocation = 'pantry' | 'fridge' | 'freezer';

export interface PantryItem {
  id: string;
  canonicalId: string;
  canonicalName: string;
  category: string | null;
  quantity: number;
  /** True when the item is on hand but its amount was never quantified. */
  amountUnknown: boolean;
  unit: string | null;
  location: PantryLocation;
  expiresOn: string | null;
  restockMuted: boolean;
  /** Typical package size for this ingredient — the reference for "running low". */
  packageQuantity: number | null;
  packageUnit: string | null;
  densityGPerMl: number | null;
  countToGram: number | null;
}

export async function listPantry(householdId: string): Promise<PantryItem[]> {
  const { data, error } = await supabase
    .from('pantry_item')
    .select(
      'id, canonical_ingredient_id, quantity, amount_unknown, unit, location, expires_on, restock_muted, canonical_ingredient(name, category, unit_size_quantity, unit_size_unit, density_g_per_ml, count_to_gram)',
    )
    .eq('household_id', householdId)
    .order('location', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    canonicalId: r.canonical_ingredient_id,
    canonicalName: r.canonical_ingredient?.name ?? 'Unknown',
    category: r.canonical_ingredient?.category ?? null,
    quantity: Number(r.quantity),
    amountUnknown: r.amount_unknown,
    unit: r.unit,
    location: r.location as PantryLocation,
    expiresOn: r.expires_on,
    restockMuted: r.restock_muted,
    packageQuantity: r.canonical_ingredient?.unit_size_quantity ?? null,
    packageUnit: r.canonical_ingredient?.unit_size_unit ?? null,
    densityGPerMl: r.canonical_ingredient?.density_g_per_ml ?? null,
    countToGram: r.canonical_ingredient?.count_to_gram ?? null,
  }));
}

/** Dismiss a low-stock suggestion until the item is restocked. */
export async function setRestockMuted(id: string, muted: boolean): Promise<void> {
  const { error } = await supabase
    .from('pantry_item')
    .update({ restock_muted: muted })
    .eq('id', id);
  if (error) throw error;
}

/** Add or replace a pantry row for a canonical ingredient at a location. */
export async function upsertPantryItem(
  householdId: string,
  input: {
    canonicalId: string;
    quantity: number;
    unit: string | null;
    location: PantryLocation;
    expiresOn?: string | null;
    amountUnknown?: boolean;
  },
): Promise<void> {
  const { error } = await supabase.from('pantry_item').upsert(
    {
      household_id: householdId,
      canonical_ingredient_id: input.canonicalId,
      quantity: input.quantity,
      amount_unknown: input.amountUnknown ?? false,
      unit: input.unit,
      location: input.location,
      expires_on: input.expiresOn ?? null,
    },
    { onConflict: 'household_id,canonical_ingredient_id,location' },
  );
  if (error) throw error;
}

export async function updatePantryItem(
  id: string,
  patch: { quantity?: number; unit?: string | null; expiresOn?: string | null; amountUnknown?: boolean },
): Promise<void> {
  const row: {
    quantity?: number;
    unit?: string | null;
    expires_on?: string | null;
    amount_unknown?: boolean;
  } = {};
  if (patch.quantity !== undefined) row.quantity = patch.quantity;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.expiresOn !== undefined) row.expires_on = patch.expiresOn;
  if (patch.amountUnknown !== undefined) row.amount_unknown = patch.amountUnknown;
  const { error } = await supabase.from('pantry_item').update(row).eq('id', id);
  if (error) throw error;
}

export async function removePantryItem(id: string): Promise<void> {
  const { error } = await supabase.from('pantry_item').delete().eq('id', id);
  if (error) throw error;
}

export interface RecipeConsumption {
  servings: number;
  ingredients: { canonicalId: string; quantity: number | null; unit: string | null }[];
}

/** A recipe's base servings + its canonical-matched ingredients, for decrementing on cook. */
export async function fetchRecipeConsumption(recipeId: string): Promise<RecipeConsumption> {
  const [{ data: recipe, error: rErr }, { data: rows, error: iErr }] = await Promise.all([
    supabase.from('recipe').select('servings').eq('id', recipeId).single(),
    supabase
      .from('recipe_ingredient')
      .select('canonical_ingredient_id, quantity, unit')
      .eq('recipe_id', recipeId),
  ]);
  if (rErr) throw rErr;
  if (iErr) throw iErr;
  return {
    servings: recipe?.servings ?? 1,
    ingredients: (rows ?? [])
      .filter((r): r is typeof r & { canonical_ingredient_id: string } => !!r.canonical_ingredient_id)
      .map((r) => ({ canonicalId: r.canonical_ingredient_id, quantity: r.quantity, unit: r.unit })),
  };
}

/**
 * Adjust pantry stock for a canonical ingredient by a signed amount (positive =
 * bought, negative = consumed). Finds any existing row for the ingredient and
 * converts the delta into that row's unit via the engine; if it can't reconcile
 * the units it leaves the row untouched rather than corrupting it. Creates a
 * pantry row when adding to something not tracked yet. Clamps at 0.
 */
export async function adjustPantryStock(
  householdId: string,
  canonicalId: string,
  deltaQty: number,
  deltaUnit: string | null,
  info: ConversionInfo = {},
): Promise<void> {
  const { data: rows, error } = await supabase
    .from('pantry_item')
    .select('id, quantity, unit, amount_unknown')
    .eq('household_id', householdId)
    .eq('canonical_ingredient_id', canonicalId)
    .order('location', { ascending: true })
    .limit(1);
  if (error) throw error;
  const existing = rows?.[0];

  // An unquantified "have some" row has no measured amount to add to or subtract
  // from — leave it as-is rather than inventing a number.
  if (existing?.amount_unknown) return;

  if (!existing) {
    if (deltaQty <= 0) return; // nothing to subtract from
    const { error: insErr } = await supabase.from('pantry_item').insert({
      household_id: householdId,
      canonical_ingredient_id: canonicalId,
      quantity: deltaQty,
      unit: deltaUnit,
      location: 'pantry',
    });
    if (insErr) throw insErr;
    return;
  }

  let deltaInUnit = deltaQty;
  if (existing.unit && deltaUnit && existing.unit !== deltaUnit) {
    const conv = convert(Math.abs(deltaQty), deltaUnit as Unit, existing.unit as Unit, {
      densityGPerMl: info.densityGPerMl ?? undefined,
      countToGram: info.countToGram ?? undefined,
    });
    if (!conv.ok) return; // units can't be reconciled — don't corrupt the row
    deltaInUnit = Math.sign(deltaQty) * conv.quantity;
  }

  const newQty = Math.max(0, Number(existing.quantity) + deltaInUnit);
  // Restocking (a positive adjustment) clears any dismissed low-stock suggestion.
  const patch: { quantity: number; restock_muted?: boolean } = { quantity: newQty };
  if (deltaQty > 0) patch.restock_muted = false;
  const { error: updErr } = await supabase.from('pantry_item').update(patch).eq('id', existing.id);
  if (updErr) throw updErr;
}
