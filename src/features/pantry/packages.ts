import type { ConversionInfo } from '@/features/pricing/price-item';
import { convert, type Unit } from '@/lib/ingredients';

/**
 * One stack of identical sealed containers on hand — e.g. `{ size: 32, unit:
 * 'oz', count: 2 }` is "two 32oz cans". These sit under a pantry_item and
 * describe how its total quantity is packaged. The remainder of the item's
 * quantity beyond the sealed packages is the loose/opened amount.
 */
export interface PackageLine {
  id?: string;
  size: number;
  unit: string;
  count: number;
}

// Float slack so a total that's equal-after-conversion doesn't spuriously open a
// container (e.g. 453.592 g vs 1 lb).
const EPSILON = 1e-6;

function toItemUnit(
  amount: number,
  unit: string,
  itemUnit: string | null,
  info: ConversionInfo,
): number | null {
  if (!itemUnit || unit === itemUnit) return amount;
  const conv = convert(amount, unit as Unit, itemUnit as Unit, {
    densityGPerMl: info.densityGPerMl ?? undefined,
    countToGram: info.countToGram ?? undefined,
  });
  return conv.ok ? conv.quantity : null;
}

/**
 * Total amount held in sealed packages, expressed in the item's unit. Lines
 * whose unit can't be reconciled with the item's are skipped rather than guessed
 * (same precision-first stance as the conversion engine).
 */
export function sealedTotal(
  lines: PackageLine[],
  itemUnit: string | null,
  info: ConversionInfo = {},
): number {
  let total = 0;
  for (const l of lines) {
    const inUnit = toItemUnit(l.size * l.count, l.unit, itemUnit, info);
    if (inUnit != null) total += inUnit;
  }
  return total;
}

/** Loose/opened amount = whatever of the total isn't in a sealed package. */
export function looseAmount(
  quantity: number,
  lines: PackageLine[],
  itemUnit: string | null,
  info: ConversionInfo = {},
): number {
  return Math.max(0, quantity - sealedTotal(lines, itemUnit, info));
}

/**
 * Record a purchased container: bump the matching (size, unit) stack or add a new
 * one. Used when a shopping item is checked off and we know exactly what was
 * bought.
 */
export function mergePurchasedPackage(
  lines: PackageLine[],
  pkg: { size: number; unit: string; count: number },
): PackageLine[] {
  const idx = lines.findIndex((l) => l.size === pkg.size && l.unit === pkg.unit);
  if (idx === -1) return [...lines, { size: pkg.size, unit: pkg.unit, count: pkg.count }];
  return lines.map((l, i) => (i === idx ? { ...l, count: l.count + pkg.count } : l));
}

/**
 * Shrink the sealed packages so they never claim more than the on-hand total —
 * used when stock drops (cooking). "Opens" the smallest container first
 * (decrement its count, drop the line at zero) until the sealed total fits under
 * `newTotal`; the difference becomes the loose remainder. Lines whose unit can't
 * convert to the item's unit are left alone (we can't compare them), which also
 * bounds the loop.
 */
export function reconcileToTotal(
  lines: PackageLine[],
  newTotal: number,
  itemUnit: string | null,
  info: ConversionInfo = {},
): PackageLine[] {
  const result = lines.map((l) => ({ ...l }));

  while (sealedTotal(result, itemUnit, info) > newTotal + EPSILON) {
    // Smallest convertible, still-sealed container.
    let smallestIdx = -1;
    let smallestSize = Infinity;
    for (let i = 0; i < result.length; i++) {
      const line = result[i]!;
      if (line.count <= 0) continue;
      const inUnit = toItemUnit(line.size, line.unit, itemUnit, info);
      if (inUnit == null) continue; // can't compare — never open it
      if (inUnit < smallestSize) {
        smallestSize = inUnit;
        smallestIdx = i;
      }
    }
    if (smallestIdx === -1) break; // nothing left we can open

    const line = result[smallestIdx]!;
    line.count -= 1;
  }

  return result.filter((l) => l.count > 0);
}
