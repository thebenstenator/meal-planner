import type { CanonicalInfo } from '@/lib/ingredients';
import type { Unit } from '@/lib/ingredients';
import { supabase } from '@/lib/supabase/client';

export const ingredientKeys = {
  list: (householdId: string, search: string) =>
    ['canonical-ingredients', householdId, search] as const,
  match: (householdId: string, raw: string) =>
    ['canonical-match', householdId, raw] as const,
};

export interface CanonicalIngredient {
  id: string;
  householdId: string | null;
  name: string;
  aliases: string[];
  category: string | null;
  defaultUnit: string | null;
  densityGPerMl: number | null;
  unitSizeQuantity: number | null;
  unitSizeUnit: string | null;
  countToGram: number | null;
  mergedIntoId: string | null;
  /** True for shared reference rows (read-only in the UI). */
  isGlobal: boolean;
}

export interface MatchResult {
  canonicalIngredientId: string;
  name: string;
  method: 'learned' | 'exact' | 'alias' | 'trigram';
  score: number;
}

type Row = {
  id: string;
  household_id: string | null;
  name: string;
  aliases: string[];
  category: string | null;
  default_unit: string | null;
  density_g_per_ml: number | null;
  unit_size_quantity: number | null;
  unit_size_unit: string | null;
  count_to_gram: number | null;
  merged_into_id: string | null;
};

function fromRow(r: Row): CanonicalIngredient {
  return {
    id: r.id,
    householdId: r.household_id,
    name: r.name,
    aliases: r.aliases ?? [],
    category: r.category,
    defaultUnit: r.default_unit,
    densityGPerMl: r.density_g_per_ml,
    unitSizeQuantity: r.unit_size_quantity,
    unitSizeUnit: r.unit_size_unit,
    countToGram: r.count_to_gram,
    mergedIntoId: r.merged_into_id,
    isGlobal: r.household_id === null,
  };
}

/** Map a canonical row to the engine's CanonicalInfo (specs/05 conversion facts). */
export function toCanonicalInfo(c: CanonicalIngredient): CanonicalInfo {
  return {
    id: c.id,
    name: c.name,
    category: c.category ?? undefined,
    defaultUnit: (c.defaultUnit as Unit | null) ?? undefined,
    densityGPerMl: c.densityGPerMl ?? undefined,
    countToGram: c.countToGram ?? undefined,
    unitSize:
      c.unitSizeQuantity != null && c.unitSizeUnit != null
        ? { quantity: c.unitSizeQuantity, unit: c.unitSizeUnit as Unit }
        : undefined,
  };
}

const SELECT =
  'id, household_id, name, aliases, category, default_unit, density_g_per_ml, unit_size_quantity, unit_size_unit, count_to_gram, merged_into_id';

/** Browse/search canonical ingredients (global + own household), excluding merged rows. */
export async function listCanonical(
  householdId: string,
  search: string,
): Promise<CanonicalIngredient[]> {
  let query = supabase
    .from('canonical_ingredient')
    .select(SELECT)
    .is('merged_into_id', null)
    .or(`household_id.is.null,household_id.eq.${householdId}`)
    .order('name', { ascending: true })
    .limit(100);

  const trimmed = search.trim();
  if (trimmed.length > 0) {
    query = query.ilike('name', `%${trimmed}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

/** Run the ordered matcher (exact → alias → learned → trigram). */
export async function matchCanonical(
  householdId: string,
  raw: string,
): Promise<MatchResult | null> {
  const { data, error } = await supabase.rpc('match_canonical_ingredient', {
    p_household_id: householdId,
    p_raw: raw,
  });
  if (error) throw error;
  const first = data?.[0];
  if (!first) return null;
  return {
    canonicalIngredientId: first.canonical_ingredient_id,
    name: first.name,
    method: first.method as MatchResult['method'],
    score: Number(first.score),
  };
}

export interface CanonicalInput {
  name: string;
  aliases: string[];
  category: string | null;
  defaultUnit: string | null;
  densityGPerMl: number | null;
  unitSizeQuantity: number | null;
  unitSizeUnit: string | null;
  countToGram: number | null;
}

export async function createHouseholdCanonical(
  householdId: string,
  input: CanonicalInput,
): Promise<string> {
  const { data, error } = await supabase
    .from('canonical_ingredient')
    .insert({ household_id: householdId, ...toDbInput(input) })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateCanonical(id: string, input: CanonicalInput): Promise<void> {
  const { error } = await supabase
    .from('canonical_ingredient')
    .update(toDbInput(input))
    .eq('id', id);
  if (error) throw error;
}

/** Set just an ingredient's category (RLS no-ops on read-only global rows). */
export async function setCanonicalCategory(id: string, category: string | null): Promise<void> {
  const { error } = await supabase
    .from('canonical_ingredient')
    .update({ category })
    .eq('id', id);
  if (error) throw error;
}

/** Soft-merge: point `sourceId` at `targetId` (household rows only, per RLS). */
export async function mergeCanonical(sourceId: string, targetId: string): Promise<void> {
  const { error } = await supabase
    .from('canonical_ingredient')
    .update({ merged_into_id: targetId })
    .eq('id', sourceId);
  if (error) throw error;
}

/** Remember a household's raw-name → canonical mapping (compounds over time). */
export async function learnMapping(
  householdId: string,
  rawName: string,
  canonicalIngredientId: string,
): Promise<void> {
  const { error } = await supabase.from('household_ingredient_map').upsert(
    { household_id: householdId, raw_name: rawName, canonical_ingredient_id: canonicalIngredientId },
    { onConflict: 'household_id,raw_name' },
  );
  if (error) throw error;
}

function toDbInput(input: CanonicalInput) {
  return {
    name: input.name,
    aliases: input.aliases,
    category: input.category,
    default_unit: input.defaultUnit,
    density_g_per_ml: input.densityGPerMl,
    unit_size_quantity: input.unitSizeQuantity,
    unit_size_unit: input.unitSizeUnit,
    count_to_gram: input.countToGram,
  };
}
