/**
 * The fixed unit enum and everything needed to convert between units.
 *
 * Pure data + pure functions. No React, no Supabase (see specs/05).
 */

export type Dimension = 'mass' | 'volume' | 'count' | 'vague';

export type Unit =
  // mass
  | 'g'
  | 'kg'
  | 'oz'
  | 'lb'
  // volume
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'floz'
  | 'cup'
  | 'pt'
  | 'qt'
  | 'gal'
  // count
  | 'each'
  | 'clove'
  | 'slice'
  | 'can'
  | 'package'
  | 'bunch'
  | 'head'
  | 'stick'
  // vague (never summed)
  | 'pinch'
  | 'dash'
  | 'to_taste';

interface UnitMeta {
  dimension: Dimension;
  /**
   * Factor to the dimension's base unit (grams for mass, millilitres for
   * volume). Undefined for count/vague units, which have no linear conversion
   * to a base within their dimension.
   */
  toBase?: number;
}

// Base units: mass -> g, volume -> ml.
export const UNIT_META: Record<Unit, UnitMeta> = {
  // mass
  g: { dimension: 'mass', toBase: 1 },
  kg: { dimension: 'mass', toBase: 1000 },
  oz: { dimension: 'mass', toBase: 28.349523125 },
  lb: { dimension: 'mass', toBase: 453.59237 },
  // volume (US customary)
  ml: { dimension: 'volume', toBase: 1 },
  l: { dimension: 'volume', toBase: 1000 },
  tsp: { dimension: 'volume', toBase: 4.928921594 },
  tbsp: { dimension: 'volume', toBase: 14.78676478 },
  floz: { dimension: 'volume', toBase: 29.5735296 },
  cup: { dimension: 'volume', toBase: 236.5882365 },
  pt: { dimension: 'volume', toBase: 473.176473 },
  qt: { dimension: 'volume', toBase: 946.352946 },
  gal: { dimension: 'volume', toBase: 3785.411784 },
  // count
  each: { dimension: 'count' },
  clove: { dimension: 'count' },
  slice: { dimension: 'count' },
  can: { dimension: 'count' },
  package: { dimension: 'count' },
  bunch: { dimension: 'count' },
  head: { dimension: 'count' },
  stick: { dimension: 'count' },
  // vague
  pinch: { dimension: 'vague' },
  dash: { dimension: 'vague' },
  to_taste: { dimension: 'vague' },
};

export function dimensionOf(unit: Unit): Dimension {
  return UNIT_META[unit].dimension;
}

/**
 * Container count units whose parenthetical size should multiply out — e.g.
 * "2 (14 oz) cans" is really 28 oz. Distinct from count units like "clove".
 */
export const CONTAINER_UNITS: ReadonlySet<Unit> = new Set<Unit>([
  'can',
  'package',
]);

/**
 * Exhaustive alias table: every spelling/abbreviation a recipe might use,
 * mapped to the canonical Unit. Keys are lowercase; punctuation is stripped
 * before lookup (see resolveUnit in normalize.ts). Cheap to extend, and
 * prevents a whole class of "tbsp vs tablespoon vs T" bugs.
 */
export const UNIT_ALIASES: Record<string, Unit> = {
  // mass
  g: 'g',
  gram: 'g',
  grams: 'g',
  gr: 'g',
  gm: 'g',
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  // volume
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  tsp: 'tsp',
  tsps: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  t: 'tsp',
  tbsp: 'tbsp',
  tbsps: 'tbsp',
  tbs: 'tbsp',
  tbl: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  'fl oz': 'floz',
  floz: 'floz',
  'fluid ounce': 'floz',
  'fluid ounces': 'floz',
  cup: 'cup',
  cups: 'cup',
  c: 'cup',
  pt: 'pt',
  pint: 'pt',
  pints: 'pt',
  qt: 'qt',
  quart: 'qt',
  quarts: 'qt',
  gal: 'gal',
  gallon: 'gal',
  gallons: 'gal',
  // count
  each: 'each',
  ea: 'each',
  whole: 'each',
  clove: 'clove',
  cloves: 'clove',
  slice: 'slice',
  slices: 'slice',
  can: 'can',
  cans: 'can',
  package: 'package',
  packages: 'package',
  pkg: 'package',
  pkgs: 'package',
  pack: 'package',
  packet: 'package',
  box: 'package',
  boxes: 'package',
  bag: 'package',
  bags: 'package',
  jar: 'package',
  jars: 'package',
  bottle: 'package',
  bottles: 'package',
  container: 'package',
  containers: 'package',
  carton: 'package',
  cartons: 'package',
  bunch: 'bunch',
  bunches: 'bunch',
  head: 'head',
  heads: 'head',
  stick: 'stick',
  sticks: 'stick',
  stalk: 'each',
  stalks: 'each',
  sprig: 'each',
  sprigs: 'each',
  loaf: 'each',
  loaves: 'each',
  ear: 'each',
  ears: 'each',
  fillet: 'each',
  fillets: 'each',
  // vague
  pinch: 'pinch',
  pinches: 'pinch',
  dash: 'dash',
  dashes: 'dash',
};

// Capital-T tablespoon is a common convention that the lowercased table can't
// distinguish from "t" (teaspoon). Callers that preserve case can consult this.
export const CASE_SENSITIVE_UNIT_ALIASES: Record<string, Unit> = {
  T: 'tbsp',
  Tbs: 'tbsp',
  Tbsp: 'tbsp',
};
