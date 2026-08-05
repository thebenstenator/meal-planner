import { convert, type Unit } from '@/lib/ingredients';

import type { ConversionInfo, PriceInfo } from '@/features/pricing/price-item';

/**
 * Consumption cost of the quantity a recipe actually *uses* — the portion of a
 * package, not a whole package. E.g. 2 oz from a $3.00 / 15 oz bottle ≈ $0.40.
 *
 * This is deliberately different from estimateItemCost (which rounds up to whole
 * store packages for the shopping list): here we charge the proportional amount,
 * so per-meal costs are comparable and don't over-count pantry staples. Returns
 * null when the used quantity can't be expressed in the package's unit.
 */
export function consumptionCost(
  usedQuantity: number | null,
  usedUnit: string | null,
  price: PriceInfo,
  info: ConversionInfo = {},
): number | null {
  if (usedQuantity == null || usedUnit == null) return null;
  if (price.packageQuantity <= 0) return null;

  const converted = convert(usedQuantity, usedUnit as Unit, price.packageUnit as Unit, {
    densityGPerMl: info.densityGPerMl ?? undefined,
    countToGram: info.countToGram ?? undefined,
  });
  if (!converted.ok) return null;

  const unitPriceCents = price.priceCents / price.packageQuantity;
  return unitPriceCents * converted.quantity;
}

export interface CostableIngredient {
  quantity: number | null;
  unit: string | null;
  canonicalId: string | null;
  isOptional?: boolean;
}

export interface RecipeCost {
  /** Summed consumption cost of the priced ingredients, in whole cents. */
  totalCents: number;
  /** totalCents divided by servings (>= 1), rounded to whole cents. */
  perServingCents: number;
  pricedCount: number;
  /** Ingredients we couldn't cost (no canonical match, no price, or no convertible unit). */
  unpricedCount: number;
}

/**
 * Aggregate the consumption cost of a recipe's ingredients. Optional ingredients
 * are skipped (not counted as unpriced) since they're not a committed cost.
 * `servings` is clamped to at least 1 for the per-serving figure.
 */
export function recipeCost(
  ingredients: CostableIngredient[],
  servings: number,
  priceByCanonical: Map<string, PriceInfo>,
  infoByCanonical: Map<string, ConversionInfo>,
): RecipeCost {
  let totalCents = 0;
  let pricedCount = 0;
  let unpricedCount = 0;

  for (const ing of ingredients) {
    if (ing.isOptional) continue;
    const price = ing.canonicalId ? priceByCanonical.get(ing.canonicalId) : undefined;
    if (!price) {
      unpricedCount += 1;
      continue;
    }
    const info = (ing.canonicalId && infoByCanonical.get(ing.canonicalId)) || {};
    const cents = consumptionCost(ing.quantity, ing.unit, price, info);
    if (cents == null) {
      unpricedCount += 1;
      continue;
    }
    totalCents += cents;
    pricedCount += 1;
  }

  const rounded = Math.round(totalCents);
  const perServingCents = Math.round(totalCents / Math.max(1, servings));
  return { totalCents: rounded, perServingCents, pricedCount, unpricedCount };
}
