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
  unit: string | null;
  location: PantryLocation;
  expiresOn: string | null;
}

export async function listPantry(householdId: string): Promise<PantryItem[]> {
  const { data, error } = await supabase
    .from('pantry_item')
    .select('id, canonical_ingredient_id, quantity, unit, location, expires_on, canonical_ingredient(name, category)')
    .eq('household_id', householdId)
    .order('location', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    canonicalId: r.canonical_ingredient_id,
    canonicalName: r.canonical_ingredient?.name ?? 'Unknown',
    category: r.canonical_ingredient?.category ?? null,
    quantity: Number(r.quantity),
    unit: r.unit,
    location: r.location as PantryLocation,
    expiresOn: r.expires_on,
  }));
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
  },
): Promise<void> {
  const { error } = await supabase.from('pantry_item').upsert(
    {
      household_id: householdId,
      canonical_ingredient_id: input.canonicalId,
      quantity: input.quantity,
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
  patch: { quantity?: number; unit?: string | null; expiresOn?: string | null },
): Promise<void> {
  const row: { quantity?: number; unit?: string | null; expires_on?: string | null } = {};
  if (patch.quantity !== undefined) row.quantity = patch.quantity;
  if (patch.unit !== undefined) row.unit = patch.unit;
  if (patch.expiresOn !== undefined) row.expires_on = patch.expiresOn;
  const { error } = await supabase.from('pantry_item').update(row).eq('id', id);
  if (error) throw error;
}

export async function removePantryItem(id: string): Promise<void> {
  const { error } = await supabase.from('pantry_item').delete().eq('id', id);
  if (error) throw error;
}
