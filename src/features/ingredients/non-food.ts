// Non-food detection, keyword-only and precision-first — no AI, no network.
//
// Two jobs, one list:
//   1. guess-category.ts files these under the Household aisle.
//   2. the pantry check-off (use-pantry.ts) skips them, so buying toilet paper
//      or shampoo never lands in your food inventory.
//
// Precision over recall on purpose: a keyword has to be distinctively non-food.
// A miss just means an item is treated as food (the pre-existing behaviour);
// a false positive would silently drop a real grocery from the pantry, which is
// worse. So anything ambiguous with a food ("salt", "oil", "bar", "pad") is only
// listed as a multi-word phrase ("softener salt", "motor oil", "maxi pad").

export const NON_FOOD_KEYWORDS: string[] = [
  // Paper & disposables
  'paper towel', 'paper towels', 'toilet paper', 'napkin', 'napkins', 'tissue', 'tissues',
  'paper plates', 'paper cups', 'plastic cups', 'plastic utensils', 'foil', 'aluminum foil',
  'plastic wrap', 'parchment paper', 'wax paper', 'ziploc', 'freezer bags', 'sandwich bags',
  'storage bags', 'trash bag', 'trash bags', 'garbage bag', 'garbage bags',
  // Cleaning
  'dish soap', 'dish detergent', 'dishwasher', 'detergent', 'laundry', 'fabric softener',
  'dryer sheet', 'dryer sheets', 'bleach', 'cleaner', 'disinfectant', 'disinfecting wipes',
  // "sponges" (plural) is the cleaning kind; bare "sponge" is left out so
  // "sponge cake" stays food.
  'air freshener', 'sponges', 'scrubber', 'mop', 'broom', 'clorox', 'lysol', 'windex', 'swiffer',
  // Personal care
  'soap', 'hand soap', 'bar soap', 'body wash', 'shampoo', 'conditioner', 'lotion', 'moisturizer',
  'sunscreen', 'toothpaste', 'toothbrush', 'mouthwash', 'floss', 'deodorant', 'razor', 'razors',
  'shaving cream', 'shave gel', 'hand sanitizer', 'sanitizer', 'chapstick', 'lip balm',
  'q-tip', 'q-tips', 'cotton swab', 'cotton swabs', 'cotton ball', 'cotton balls',
  'band-aid', 'bandage', 'bandages', 'contact solution', 'tampon', 'tampons', 'panty liner',
  'maxi pad', 'feminine pad', 'wipes', 'baby wipes', 'diaper', 'diapers',
  // Cosmetics
  'cosmetic', 'cosmetics', 'makeup', 'make-up', 'mascara', 'lipstick', 'nail polish', 'concealer',
  // Pet
  'dog food', 'cat food', 'pet food', 'cat litter', 'kitty litter', 'dog treats', 'cat treats',
  'bird seed',
  // Household goods
  'battery', 'batteries', 'light bulb', 'light bulbs', 'candle', 'candles', 'matches', 'lighter',
  'lighter fluid', 'charcoal', 'propane', 'motor oil',
  // Water & garden
  'water softener', 'softener salt', 'pool salt', 'epsom salt', 'water filter', 'ice melt',
  'fertilizer', 'potting soil', 'plant food',
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when a name is confidently a non-food, household or personal-care item.
 * Whole-word matched (so "salt" never leaks in via "softener salt", and vice
 * versa) and case-insensitive. Unsure → false, i.e. treat it as food.
 */
export function isNonFood(name: string): boolean {
  const lower = name.toLowerCase();
  for (const kw of NON_FOOD_KEYWORDS) {
    const re = new RegExp(`(^|[^a-z])${escapeRegExp(kw)}([^a-z]|$)`);
    if (re.test(lower)) return true;
  }
  return false;
}
