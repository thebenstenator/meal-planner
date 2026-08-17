import { supabase } from '@/lib/supabase/client';

/**
 * Per-household "track this ingredient in the pantry?" overrides, keyed by
 * canonical id. Set from the check-off toggle; read at check-off to decide
 * whether a purchase lands in the pantry (see track-decision.ts).
 */
export async function fetchPantryPrefs(householdId: string): Promise<Map<string, boolean>> {
  const { data, error } = await supabase
    .from('household_ingredient_pantry_pref')
    .select('canonical_ingredient_id, tracked')
    .eq('household_id', householdId);
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.canonical_ingredient_id, r.tracked]));
}

/** Remember whether an ingredient should be tracked in the pantry when bought. */
export async function setPantryPref(
  householdId: string,
  canonicalIngredientId: string,
  tracked: boolean,
): Promise<void> {
  const { error } = await supabase.from('household_ingredient_pantry_pref').upsert(
    {
      household_id: householdId,
      canonical_ingredient_id: canonicalIngredientId,
      tracked,
    },
    { onConflict: 'household_id,canonical_ingredient_id' },
  );
  if (error) throw error;
}
