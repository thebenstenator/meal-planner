import { supabase } from '@/lib/supabase/client';

/**
 * Per-household "track this ingredient in the pantry?" overrides, keyed by
 * canonical id.
 *
 * A plain object, not a Map, because this is query data and the query cache is
 * persisted to localStorage — a Map JSON-round-trips to `{}`, and the `{}` comes
 * back as a plain object that still passes a `?? fallback` check, so every
 * `.get()` on it throws. See the v5 note in lib/query/persister.ts.
 */
export type PantryPrefs = Record<string, boolean>;

/**
 * Set from the check-off toggle; read at check-off to decide whether a purchase
 * lands in the pantry (see track-decision.ts).
 */
export async function fetchPantryPrefs(householdId: string): Promise<PantryPrefs> {
  const { data, error } = await supabase
    .from('household_ingredient_pantry_pref')
    .select('canonical_ingredient_id, tracked')
    .eq('household_id', householdId);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.canonical_ingredient_id, r.tracked]));
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
