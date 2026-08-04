import { convert, type Unit } from '@/lib/ingredients';

export interface PriceInfo {
  priceCents: number;
  packageQuantity: number;
  packageUnit: string;
}

export interface ConversionInfo {
  densityGPerMl?: number | null;
  countToGram?: number | null;
}

/**
 * Estimated cost for a needed quantity, priced on the PURCHASED amount — i.e.
 * rounded up to whole store packages (specs/05: "cost is calculated on the
 * purchased quantity, not the needed quantity"). Returns null when the need
 * can't be expressed in the package's unit (missing density/count fact).
 */
export function estimateItemCost(
  neededQuantity: number | null,
  neededUnit: string | null,
  price: PriceInfo,
  info: ConversionInfo = {},
): number | null {
  if (neededQuantity == null || neededUnit == null) return null;
  if (price.packageQuantity <= 0) return null;

  const converted = convert(neededQuantity, neededUnit as Unit, price.packageUnit as Unit, {
    densityGPerMl: info.densityGPerMl ?? undefined,
    countToGram: info.countToGram ?? undefined,
  });
  if (!converted.ok) return null;

  const packages = Math.max(1, Math.ceil(converted.quantity / price.packageQuantity - 1e-9));
  return packages * price.priceCents;
}
