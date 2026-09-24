import { toCanonicalInfo } from '@/features/ingredients/api';
import { deduceCategory } from '@/features/shopping-list/categories';
import { fetchIngredientCategories } from '@/features/shopping-list/categories-api';
import {
  cleanName,
  consolidate,
  convert,
  roundToPurchase,
  type CanonicalInfo,
  type ConsolidationInput,
  type Unit,
} from '@/lib/ingredients';
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
  pantry_offset_quantity: number | null;
  sources: GenItemSource[];
}

/** A recipe reduced to what the consolidation engine needs, plus how much of it
 * to buy (servings_override / base servings). `ref` ties each line back to its
 * source for the "why is this here?" trail. */
interface RecipeInput {
  ingredients: Array<{
    id: string | null;
    quantity: number | null;
    unit: string | null;
    canonicalId: string | null;
    rawText: string;
  }>;
  scale: number;
  /** Plan entry this recipe came from, if any — folded into each line's ref. */
  entryId: string | null;
}

interface BuiltInputs {
  inputs: ConsolidationInput[];
  displayByKey: Map<string, string>;
  canonicalIds: Set<string>;
}

/** Flatten recipes into engine inputs, keyed by canonical id (or cleaned name
 * for unmatched lines) so the same ingredient across recipes consolidates. */
function buildInputs(recipes: RecipeInput[]): BuiltInputs {
  const inputs: ConsolidationInput[] = [];
  const displayByKey = new Map<string, string>();
  const canonicalIds = new Set<string>();

  for (const { ingredients, scale, entryId } of recipes) {
    for (const ing of ingredients) {
      const canonicalId = ing.canonicalId;
      const cleaned = cleanName(ing.rawText).name || ing.rawText.trim();
      const key = canonicalId ?? `${UNMATCHED}${cleaned}`;
      if (canonicalId) canonicalIds.add(canonicalId);
      if (!displayByKey.has(key)) displayByKey.set(key, cleaned);

      inputs.push({
        canonicalId: key,
        quantity: ing.quantity,
        unit: (ing.unit as Unit | null) ?? null,
        scale,
        ref: `${ing.id ?? ''}|${entryId ?? ''}`,
        name: cleaned,
      });
    }
  }

  return { inputs, displayByKey, canonicalIds };
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
  subtractPantry = true,
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

  const recipes: RecipeInput[] = (data ?? []).flatMap((entry) => {
    const recipe = entry.recipe;
    if (!recipe) return [];
    return [
      {
        scale: entry.servings_override ? entry.servings_override / recipe.servings : 1,
        entryId: entry.id,
        ingredients: (recipe.recipe_ingredient ?? []).map((ing) => ({
          id: ing.id,
          quantity: ing.quantity,
          unit: ing.unit,
          canonicalId: ing.canonical_ingredient_id,
          rawText: ing.raw_text,
        })),
      },
    ];
  });

  return consolidateWithPantry(householdId, buildInputs(recipes), subtractPantry);
}

/**
 * Build the "need to buy" items for a single recipe, scaled from its base
 * servings to `targetServings`. Same engine and pantry subtraction as the plan
 * path — with `subtractPantry`, anything already on hand drops out — so the
 * recipe's "add to shopping list" flow and the plan generator agree on what's
 * needed.
 */
export async function buildRecipeShoppingItems(
  householdId: string,
  ingredients: RecipeInput['ingredients'],
  recipeServings: number,
  targetServings: number,
  subtractPantry = true,
): Promise<GeneratedItem[]> {
  const scale = recipeServings > 0 ? targetServings / recipeServings : 1;
  return consolidateWithPantry(
    householdId,
    buildInputs([{ ingredients, scale, entryId: null }]),
    subtractPantry,
  );
}

/**
 * Shared tail of the builders: fetch conversion facts and category overrides,
 * consolidate, subtract the pantry, and shape the rows. Split out so the plan
 * and single-recipe paths differ only in how they gather their inputs.
 */
async function consolidateWithPantry(
  householdId: string,
  built: BuiltInputs,
  subtractPantry: boolean,
): Promise<GeneratedItem[]> {
  const { inputs, displayByKey, canonicalIds } = built;

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

  // Where this household files these ingredients, if they've said. Applied over
  // the ingredient's own category so a recategorized item stays put across
  // regenerations.
  const categoryOverrides =
    canonicalIds.size > 0
      ? await fetchIngredientCategories(householdId, [...canonicalIds]).catch(
          (): Record<string, string> => ({}),
        )
      : {};

  // Pantry offset: how much of each canonical is already on hand (summed across
  // locations, converted into a common unit per item at map time).
  const pantryByCanonical = new Map<string, { quantity: number; unit: string | null }[]>();
  // Canonicals the household has on hand with an unquantified amount — treated as
  // fully in stock, so they never hit the list ("we have some, just didn't measure").
  const pantryUnknown = new Set<string>();
  if (subtractPantry) {
    const { data: pantryRows, error: pErr } = await supabase
      .from('pantry_item')
      .select('canonical_ingredient_id, quantity, unit, amount_unknown')
      .eq('household_id', householdId);
    if (pErr) throw pErr;
    for (const p of pantryRows ?? []) {
      if (p.amount_unknown) {
        pantryUnknown.add(p.canonical_ingredient_id);
        continue;
      }
      const arr = pantryByCanonical.get(p.canonical_ingredient_id) ?? [];
      arr.push({ quantity: Number(p.quantity), unit: p.unit });
      pantryByCanonical.set(p.canonical_ingredient_id, arr);
    }
  }

  return items.flatMap((item) => {
    const isUnmatched = item.canonicalId.startsWith(UNMATCHED);
    const info = lookup.get(item.canonicalId);
    const displayName = info?.name ?? displayByKey.get(item.canonicalId) ?? item.name;

    // On hand with an unquantified amount → assume it covers the need, drop it.
    if (subtractPantry && !isUnmatched && pantryUnknown.has(item.canonicalId)) return [];

    // Subtract on-hand stock from resolved, matched items.
    let totalQuantity = item.totalQuantity;
    let purchase = item.purchase;
    let offset: number | null = null;
    if (
      subtractPantry &&
      !isUnmatched &&
      item.totalQuantity != null &&
      item.unit &&
      !item.unresolved
    ) {
      let onHand = 0;
      for (const row of pantryByCanonical.get(item.canonicalId) ?? []) {
        if (row.quantity <= 0) continue;
        if (!row.unit || row.unit === item.unit) {
          onHand += row.quantity;
        } else {
          const conv = convert(row.quantity, row.unit as Unit, item.unit as Unit, info ?? {});
          if (conv.ok) onHand += conv.quantity;
        }
      }
      const covered = Math.min(item.totalQuantity, onHand);
      if (covered > 0) {
        const remaining = Number((item.totalQuantity - covered).toFixed(6));
        if (remaining <= 0) return []; // fully covered — nothing to buy
        offset = Number(covered.toFixed(6));
        totalQuantity = remaining;
        purchase = info?.unitSize
          ? roundToPurchase(remaining, item.unit as Unit, info.unitSize, info)
          : item.purchase;
      }
    }

    return [
      {
        canonical_ingredient_id: isUnmatched ? null : item.canonicalId,
        ad_hoc_name: isUnmatched ? displayName : null,
        display_name: displayName,
        total_quantity: totalQuantity,
        unit: item.unit,
        category:
          categoryOverrides[item.canonicalId] ?? item.category ?? deduceCategory(displayName),
        unresolved: item.unresolved,
        sub_totals: item.subTotals.length > 0 ? item.subTotals : null,
        purchase,
        no_quantity_count: item.noQuantityCount,
        pantry_offset_quantity: offset,
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
      },
    ];
  });
}
