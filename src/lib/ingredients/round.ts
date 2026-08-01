import { convert } from '@/lib/ingredients/convert';
import type { CanonicalInfo, PurchaseSuggestion } from '@/lib/ingredients/types';
import type { Unit } from '@/lib/ingredients/units';

const EPSILON = 1e-9;

type RoundInfo = Pick<CanonicalInfo, 'densityGPerMl' | 'countToGram'>;

/**
 * Round a needed quantity UP to whole purchasable packages (specs/05, step 6).
 * "Needs 12 oz cream cheese, sold in 8 oz blocks -> buy 2 (16 oz)."
 *
 * Returns null when the need can't be expressed in the package's unit (e.g.
 * need is in cups, package is by count, and no conversion info is available).
 */
export function roundToPurchase(
  neededQuantity: number,
  neededUnit: Unit,
  unitSize: { quantity: number; unit: Unit },
  info: RoundInfo = {},
): PurchaseSuggestion | null {
  if (neededQuantity <= 0 || unitSize.quantity <= 0) return null;

  const inPackageUnit = convert(neededQuantity, neededUnit, unitSize.unit, info);
  if (!inPackageUnit.ok) return null;

  const packages = Math.max(1, Math.ceil(inPackageUnit.quantity / unitSize.quantity - EPSILON));

  return {
    packages,
    packageQuantity: unitSize.quantity,
    packageUnit: unitSize.unit,
    totalPurchaseQuantity: packages * unitSize.quantity,
  };
}
