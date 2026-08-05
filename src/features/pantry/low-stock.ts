import { convert, type Unit } from '@/lib/ingredients';

export interface LowStockInput {
  quantity: number;
  unit: string | null;
  packageQuantity: number | null;
  packageUnit: string | null;
  densityGPerMl?: number | null;
  countToGram?: number | null;
}

/** Fraction of a typical package at/below which an item counts as "running low". */
export const LOW_STOCK_FRACTION = 0.1;

/**
 * Is this pantry item running low? Out (<= 0) is always low. Otherwise it's low
 * when the remaining amount is below ~10% of a typical package (from the
 * canonical's package size), converting the pantry quantity into the package
 * unit. Without a package size — or when the units can't be reconciled — we only
 * flag it once it hits zero, to avoid false "low" nags.
 */
export function isLowStock(item: LowStockInput): boolean {
  if (item.quantity <= 0) return true;
  if (!item.packageQuantity || item.packageQuantity <= 0 || !item.packageUnit) return false;

  let inPackageUnit = item.quantity;
  if (item.unit && item.unit !== item.packageUnit) {
    const conv = convert(item.quantity, item.unit as Unit, item.packageUnit as Unit, {
      densityGPerMl: item.densityGPerMl ?? undefined,
      countToGram: item.countToGram ?? undefined,
    });
    if (!conv.ok) return false;
    inPackageUnit = conv.quantity;
  }
  return inPackageUnit < LOW_STOCK_FRACTION * item.packageQuantity;
}
