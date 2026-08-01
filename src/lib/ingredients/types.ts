import type { Unit } from '@/lib/ingredients/units';

/** Output of the deterministic parser for a single ingredient line. */
export interface ParsedIngredient {
  /** The original line, verbatim. Never reconstructed. */
  raw: string;
  quantity: number | null;
  unit: Unit | null;
  /** Cleaned ingredient name, e.g. "cream cheese". */
  name: string;
  /** Prep note extracted from the line, e.g. "softened". */
  descriptor: string | null;
  isOptional: boolean;
  /** Parser confidence, 0–1. Low values should go to the LLM fallback. */
  confidence: number;
}

/**
 * Per-ingredient knowledge the converter and rounder need. Sourced from the
 * canonical_ingredient row in the app; kept as a plain interface here so the
 * engine stays database-agnostic.
 */
export interface CanonicalInfo {
  id: string;
  name: string;
  category?: string;
  defaultUnit?: Unit | null;
  /** Grams per millilitre — enables volume↔mass. */
  densityGPerMl?: number | null;
  /** Grams per one count (e.g. 1 egg ≈ 50) — enables count↔mass. */
  countToGram?: number | null;
  /** Typical purchase package, e.g. { quantity: 8, unit: 'oz' }. */
  unitSize?: { quantity: number; unit: Unit } | null;
}

/** One recipe line, matched to a canonical ingredient, ready to consolidate. */
export interface ConsolidationInput {
  /** Grouping key. Lines with the same canonicalId merge together. */
  canonicalId: string;
  quantity: number | null;
  unit: Unit | null;
  /** Servings scale factor (servings_override / recipe.servings). Default 1. */
  scale?: number;
  /** Opaque provenance id (recipe_ingredient id, plan_entry id, …). */
  ref?: string;
  /** Display fallback when no CanonicalInfo is supplied. */
  name?: string;
}

export interface Contribution {
  ref?: string;
  quantity: number | null;
  unit: Unit | null;
  /** Amount this line added, in the item's resolved unit (null if no-quantity). */
  contributedQuantity: number | null;
}

/** A purchasable-quantity suggestion, rounded up to whole packages. */
export interface PurchaseSuggestion {
  packages: number;
  packageQuantity: number;
  packageUnit: Unit;
  /** packages × packageQuantity, in packageUnit. */
  totalPurchaseQuantity: number;
}

/** The consolidated shopping-list line for one canonical ingredient. */
export interface ConsolidatedItem {
  canonicalId: string;
  name: string;
  category?: string;
  /** Merged, summed quantity in `unit`. Null when nothing had a quantity. */
  totalQuantity: number | null;
  unit: Unit | null;
  /**
   * True when the lines could not be merged into a single unit (e.g. a
   * volume + a mass with no density). `subTotals` holds the per-unit sums.
   */
  unresolved: boolean;
  subTotals: Array<{ quantity: number; unit: Unit }>;
  /** No-quantity reminders (e.g. "salt to taste") attached to this item. */
  noQuantityCount: number;
  contributions: Contribution[];
  /** Present only when resolved and a package size was known. */
  purchase: PurchaseSuggestion | null;
}
