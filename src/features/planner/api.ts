import type { PlanEntryInput, PlanKind, Slot } from '@/schemas/plan';
import { supabase } from '@/lib/supabase/client';

export const planKeys = {
  range: (householdId: string, start: string, end: string) =>
    ['plan', householdId, start, end] as const,
  all: (householdId: string) => ['plan', householdId] as const,
};

export interface PlanEntry {
  id: string;
  date: string;
  slot: Slot;
  kind: PlanKind;
  recipeId: string | null;
  recipeTitle: string | null;
  note: string | null;
  servingsOverride: number | null;
  cookedAt: string | null;
  position: number;
}

export async function listPlanEntries(
  householdId: string,
  start: string,
  end: string,
): Promise<PlanEntry[]> {
  const { data, error } = await supabase
    .from('plan_entry')
    .select('id, date, slot, kind, recipe_id, note, servings_override, cooked_at, position, created_at, recipe(title)')
    .eq('household_id', householdId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
    .order('slot', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    slot: r.slot as Slot,
    kind: r.kind as PlanKind,
    recipeId: r.recipe_id,
    recipeTitle: r.recipe?.title ?? null,
    note: r.note,
    servingsOverride: r.servings_override,
    cookedAt: r.cooked_at,
    position: r.position,
  }));
}

export async function createPlanEntry(
  householdId: string,
  input: PlanEntryInput,
): Promise<string> {
  const { data, error } = await supabase
    .from('plan_entry')
    .insert({
      household_id: householdId,
      date: input.date,
      slot: input.slot,
      kind: input.kind,
      recipe_id: input.recipeId,
      note: input.note,
      servings_override: input.servingsOverride,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/** Move an entry to a different day/slot. */
export async function movePlanEntry(
  id: string,
  to: { date: string; slot: Slot },
): Promise<void> {
  const { error } = await supabase
    .from('plan_entry')
    .update({ date: to.date, slot: to.slot })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePlanEntry(id: string): Promise<void> {
  const { error } = await supabase.from('plan_entry').delete().eq('id', id);
  if (error) throw error;
}

/** Mark a planned meal cooked (or not). cooked_at gates the pantry decrement. */
export async function setEntryCooked(id: string, cooked: boolean): Promise<void> {
  const { error } = await supabase
    .from('plan_entry')
    .update({ cooked_at: cooked ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}
