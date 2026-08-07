import { setCanonicalCategory } from '@/features/ingredients/api';
import { invokeAiFunction } from '@/features/recipes/import';

export interface Classification {
  name: string;
  category: string;
}

/**
 * Ask the classify-ingredients Edge Function to categorize a batch of names
 * (metered, premium AI). Returns one classification per name. Kept in its own
 * module so ingredients/api stays free of the recipes import (avoids a cycle).
 */
export async function classifyIngredients(
  householdId: string,
  names: string[],
): Promise<Classification[]> {
  const data = await invokeAiFunction<{ items: Classification[] }>(
    'classify-ingredients',
    { names, household_id: householdId },
    'Could not classify those items',
  );
  return data.items;
}

/**
 * Classify a set of uncategorized ingredients and persist each result back onto
 * the ingredient, so it's a one-time cost. Matches AI results to ids by name
 * (case-insensitive). Returns how many were categorized.
 */
export async function classifyAndSave(
  householdId: string,
  items: { canonicalId: string; name: string }[],
): Promise<number> {
  const results = await classifyIngredients(
    householdId,
    [...new Set(items.map((i) => i.name))],
  );
  const byName = new Map(results.map((r) => [r.name.trim().toLowerCase(), r.category]));

  let saved = 0;
  for (const item of items) {
    const category = byName.get(item.name.trim().toLowerCase());
    if (!category) continue;
    await setCanonicalCategory(item.canonicalId, category);
    saved += 1;
  }
  return saved;
}
