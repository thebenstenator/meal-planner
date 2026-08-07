import { createHouseholdCanonical, matchCanonical } from '@/features/ingredients/api';
import { guessCategory } from '@/features/ingredients/guess-category';

export interface ResolvedCanonical {
  canonicalId: string;
  name: string;
  /** True when a new household ingredient was created for this text. */
  created: boolean;
}

/**
 * Turn a typed ingredient name into a canonical id — the "just type it and add"
 * path. Runs the same matcher the rest of the app uses; if nothing matches, a
 * new household ingredient is created from the text (with a guessed category),
 * mirroring how bulk import handles unknown rows.
 */
export async function resolveOrCreateCanonical(
  householdId: string,
  rawName: string,
): Promise<ResolvedCanonical> {
  const text = rawName.trim();
  const match = await matchCanonical(householdId, text).catch(() => null);
  if (match) {
    return { canonicalId: match.canonicalIngredientId, name: match.name, created: false };
  }
  const id = await createHouseholdCanonical(householdId, {
    name: text,
    aliases: [],
    category: guessCategory(text),
    defaultUnit: null,
    densityGPerMl: null,
    unitSizeQuantity: null,
    unitSizeUnit: null,
    countToGram: null,
  });
  return { canonicalId: id, name: text, created: true };
}
