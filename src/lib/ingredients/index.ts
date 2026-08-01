/**
 * The ingredient engine — parse, normalize, match, convert, consolidate, round.
 *
 * Pure module: no React, no Supabase. Everything else in the app calls in here.
 * See specs/05-ingredient-engine.md. Canonical-ingredient MATCHING (the [3] step)
 * lives with the database in Slice 3; this module accepts already-matched
 * `canonicalId`s and the per-ingredient `CanonicalInfo` it needs to convert.
 */
export type {
  Unit,
  Dimension,
} from '@/lib/ingredients/units';
export {
  UNIT_META,
  UNIT_ALIASES,
  dimensionOf,
} from '@/lib/ingredients/units';

export type {
  ParsedIngredient,
  CanonicalInfo,
  ConsolidationInput,
  ConsolidatedItem,
  Contribution,
  PurchaseSuggestion,
} from '@/lib/ingredients/types';

export { parse, parseLines } from '@/lib/ingredients/parse';
export { cleanName, resolveUnit } from '@/lib/ingredients/normalize';
export { convert, canConvert, type ConvertResult } from '@/lib/ingredients/convert';
export { roundToPurchase } from '@/lib/ingredients/round';
export { consolidate, type CanonicalInfoLookup } from '@/lib/ingredients/consolidate';
