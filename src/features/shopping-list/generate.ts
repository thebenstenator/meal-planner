import { toCanonicalInfo } from '@/features/ingredients/api';
import { cleanName, consolidate, type CanonicalInfo, type ConsolidationInput, type Unit } from '@/lib/ingredients';
import { supabase } from '@/lib/supabase/client';

const UNMATCHED = 'unmatched:';

interface GenItemSource {
  recipe_ingredient_id: string | null;
  plan_entry_id: string | null;
  contributed_quantity: number | null;
}

export interface GeneratedItem {
  canonical_ingredient_id: string | null;
  ad_hoc_name: string | null;
  display_name: string;
  total_quantity: number | null;
  unit: string | null;
  category: string | null;
  unresolved: boolean;
  sub_totals: Array<{ quantity: number; unit: Unit }> | null;
  purchase: unknown;
  no_quantity_count: number;
  sources: GenItemSource[];
}

/**
 * Build the consolidated shopping-list items for a date range by running the
 * plan's recipes through the engine. leftovers/eating_out/note plan entries are
 * excluded here (kind = 'recipe' filter) — that's the whole point of tracking
 * them. Returns the payload for `generate_shopping_list`.
 */
export async function buildShoppingItems(
  householdId: string,
  start: string,
  end: string,
): Promise<GeneratedItem[]> {
  const { data, error } = await supabase
    .from('plan_entry')
    .select(
      'id, servings_override, recipe:recipe_id(id, servings, recipe_ingredient(id, quantity, unit, canonical_ingredient_id, raw_text))',
    )
    .eq('household_id', householdId)
    .eq('kind', 'recipe')
    .gte('date', start)
    .lte('date', end);
  if (error) throw error;

  const inputs: ConsolidationInput[] = [];
  const displayByKey = new Map<string, string>();
  const canonicalIds = new Set<string>();

  for (const entry of data ?? []) {
    const recipe = entry.recipe;
    if (!recipe) continue;
    const scale = entry.servings_override ? entry.servings_override / recipe.servings : 1;

    for (const ing of recipe.recipe_ingredient ?? []) {
      const canonicalId = ing.canonical_ingredient_id;
      const cleaned = cleanName(ing.raw_text).name || ing.raw_text.trim();
      const key = canonicalId ?? `${UNMATCHED}${cleaned}`;
      if (canonicalId) canonicalIds.add(canonicalId);
      if (!displayByKey.has(key)) displayByKey.set(key, cleaned);

      inputs.push({
        canonicalId: key,
        quantity: ing.quantity,
        unit: (ing.unit as Unit | null) ?? null,
        scale,
        ref: `${ing.id}|${entry.id}`,
        name: cleaned,
      });
    }
  }

  // Fetch conversion facts for the matched canonical ingredients.
  const lookup = new Map<string, CanonicalInfo>();
  if (canonicalIds.size > 0) {
    const { data: cans, error: cErr } = await supabase
      .from('canonical_ingredient')
      .select(
        'id, name, category, default_unit, density_g_per_ml, unit_size_quantity, unit_size_unit, count_to_gram',
      )
      .in('id', [...canonicalIds]);
    if (cErr) throw cErr;
    for (const c of cans ?? []) {
      lookup.set(c.id, toCanonicalInfo({
        id: c.id,
        householdId: null,
        name: c.name,
        aliases: [],
        category: c.category,
        defaultUnit: c.default_unit,
        densityGPerMl: c.density_g_per_ml,
        unitSizeQuantity: c.unit_size_quantity,
        unitSizeUnit: c.unit_size_unit,
        countToGram: c.count_to_gram,
        mergedIntoId: null,
        isGlobal: true,
      }));
      displayByKey.set(c.id, c.name);
    }
  }

  const items = consolidate(inputs, (id) => lookup.get(id));

  return items.map((item) => {
    const isUnmatched = item.canonicalId.startsWith(UNMATCHED);
    const displayName = lookup.get(item.canonicalId)?.name ?? displayByKey.get(item.canonicalId) ?? item.name;
    return {
      canonical_ingredient_id: isUnmatched ? null : item.canonicalId,
      ad_hoc_name: isUnmatched ? displayName : null,
      display_name: displayName,
      total_quantity: item.totalQuantity,
      unit: item.unit,
      category: item.category ?? null,
      unresolved: item.unresolved,
      sub_totals: item.subTotals.length > 0 ? item.subTotals : null,
      purchase: item.purchase,
      no_quantity_count: item.noQuantityCount,
      sources: item.contributions
        .filter((c) => c.ref)
        .map((c) => {
          const [ri, pe] = (c.ref as string).split('|');
          return {
            recipe_ingredient_id: ri ?? null,
            plan_entry_id: pe ?? null,
            contributed_quantity: c.contributedQuantity,
          };
        }),
    };
  });
}
