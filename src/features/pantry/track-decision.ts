import { isNonFood } from '@/features/ingredients/non-food';

/** Just the fields the decision needs, so callers can pass a shopping item. */
export interface TrackInput {
  canonicalId: string | null;
  category: string | null;
  displayName: string;
}

/**
 * Whether buying this item should add it to the pantry.
 *
 * An explicit per-ingredient preference (the "Added to pantry / Not added"
 * toggle) always wins — that's the household teaching us. With no preference we
 * fall back to the automatic nets: unmatched items and non-food (Household aisle
 * or a non-food name) stay out; everything else is tracked.
 *
 * Keep this the single source of truth: the check-off's pantry write and the
 * status line both read it, so what the line says is exactly what happens.
 */
export function shouldTrackInPantry(item: TrackInput, prefs: Map<string, boolean>): boolean {
  // Unmatched items never touch the pantry — there's no ingredient to track.
  if (!item.canonicalId) return false;

  const pref = prefs.get(item.canonicalId);
  if (pref !== undefined) return pref;

  if (item.category === 'household') return false;
  return !isNonFood(item.displayName);
}
