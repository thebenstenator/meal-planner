import { convert, type Unit } from '@/lib/ingredients';

import type { ConversionInfo, PriceInfo } from '@/features/pricing/price-item';

/** Below this many items priced both ways, the estimates stay at national averages. */
export const MIN_CALIBRATION_BASIS = 5;
/** Never scale estimates further than this from the reference — a guard on bad data. */
export const CALIBRATION_BOUNDS = [0.6, 1.6] as const;

export interface CalibrationPair {
  store: PriceInfo;
  reference: PriceInfo;
  info: ConversionInfo;
}

export interface Calibration {
  /** Multiply reference prices by this to estimate this household's prices. */
  factor: number;
  /** How many items it was learned from (0 = not calibrated). */
  basis: number;
}

/**
 * How this household's prices compare to the reference (ADR 0021): the median,
 * over items it has priced itself, of its unit price ÷ the reference unit price.
 * The median ignores the odd organic or bulk buy; the clamp keeps one bad entry
 * from swinging every estimate. Needs MIN_CALIBRATION_BASIS items to apply.
 */
export function computeCalibration(pairs: CalibrationPair[]): Calibration {
  const ratios: number[] = [];
  for (const { store, reference, info } of pairs) {
    if (store.packageQuantity <= 0 || reference.priceCents <= 0) continue;
    // The reference package, expressed in the store package's unit.
    const refQty = convert(reference.packageQuantity, reference.packageUnit as Unit, store.packageUnit as Unit, {
      densityGPerMl: info.densityGPerMl ?? undefined,
      countToGram: info.countToGram ?? undefined,
    });
    if (!refQty.ok || refQty.quantity <= 0) continue;
    const storeUnit = store.priceCents / store.packageQuantity;
    const refUnit = reference.priceCents / refQty.quantity;
    ratios.push(storeUnit / refUnit);
  }

  if (ratios.length < MIN_CALIBRATION_BASIS) return { factor: 1, basis: 0 };
  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  const median =
    ratios.length % 2 ? (ratios[mid] as number) : ((ratios[mid - 1] as number) + (ratios[mid] as number)) / 2;
  const [lo, hi] = CALIBRATION_BOUNDS;
  return { factor: Math.min(hi, Math.max(lo, median)), basis: ratios.length };
}
