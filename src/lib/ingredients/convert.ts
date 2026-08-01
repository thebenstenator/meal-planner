import type { CanonicalInfo } from '@/lib/ingredients/types';
import { UNIT_META, dimensionOf, type Unit } from '@/lib/ingredients/units';

export type ConvertResult =
  | { ok: true; quantity: number }
  | { ok: false; reason: string };

type ConvertInfo = Pick<CanonicalInfo, 'densityGPerMl' | 'countToGram'>;

/**
 * Convert `quantity` of `from` into `to`.
 *
 * Three cases (specs/05):
 *  - same dimension (mass↔mass, volume↔volume): pure factor math, always safe;
 *  - volume↔mass: needs `densityGPerMl`;
 *  - count↔mass/volume: needs `countToGram` (and density for volume).
 *
 * Anything it can't do safely returns `{ ok: false }` rather than guessing —
 * the unresolved path is a feature, not a failure.
 */
export function convert(
  quantity: number,
  from: Unit,
  to: Unit,
  info: ConvertInfo = {},
): ConvertResult {
  if (from === to) return { ok: true, quantity };

  const fromDim = dimensionOf(from);
  const toDim = dimensionOf(to);

  if (fromDim === 'vague' || toDim === 'vague') {
    return { ok: false, reason: 'vague units cannot be converted' };
  }

  // Same dimension, linearly convertible (mass or volume).
  if (fromDim === toDim && (fromDim === 'mass' || fromDim === 'volume')) {
    return { ok: true, quantity: sameDimension(quantity, from, to) };
  }

  // Same count dimension but different count units (clove vs each): not
  // convertible without per-ingredient knowledge.
  if (fromDim === 'count' && toDim === 'count') {
    return { ok: false, reason: `cannot convert ${from} to ${to}` };
  }

  // Cross-dimension: bridge through grams.
  const grams = toGrams(quantity, from, info);
  if (!grams.ok) return grams;
  return fromGrams(grams.quantity, to, info);
}

function sameDimension(quantity: number, from: Unit, to: Unit): number {
  const f = UNIT_META[from].toBase;
  const t = UNIT_META[to].toBase;
  // Guaranteed defined for mass/volume by the caller.
  return (quantity * (f as number)) / (t as number);
}

function toGrams(quantity: number, from: Unit, info: ConvertInfo): ConvertResult {
  const dim = dimensionOf(from);
  if (dim === 'mass') {
    return { ok: true, quantity: quantity * (UNIT_META[from].toBase as number) };
  }
  if (dim === 'volume') {
    if (info.densityGPerMl == null) {
      return { ok: false, reason: `need density to convert ${from} to mass` };
    }
    const ml = quantity * (UNIT_META[from].toBase as number);
    return { ok: true, quantity: ml * info.densityGPerMl };
  }
  // count
  if (info.countToGram == null) {
    return { ok: false, reason: `need count_to_gram to convert ${from} to mass` };
  }
  return { ok: true, quantity: quantity * info.countToGram };
}

function fromGrams(grams: number, to: Unit, info: ConvertInfo): ConvertResult {
  const dim = dimensionOf(to);
  if (dim === 'mass') {
    return { ok: true, quantity: grams / (UNIT_META[to].toBase as number) };
  }
  if (dim === 'volume') {
    if (info.densityGPerMl == null) {
      return { ok: false, reason: `need density to convert mass to ${to}` };
    }
    const ml = grams / info.densityGPerMl;
    return { ok: true, quantity: ml / (UNIT_META[to].toBase as number) };
  }
  // count
  if (info.countToGram == null) {
    return { ok: false, reason: `need count_to_gram to convert mass to ${to}` };
  }
  return { ok: true, quantity: grams / info.countToGram };
}

/** True when `convert` would succeed for this unit pair given `info`. */
export function canConvert(from: Unit, to: Unit, info: ConvertInfo = {}): boolean {
  return convert(1, from, to, info).ok;
}
