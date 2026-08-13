import type { MealType } from '@/schemas/recipe';

// Best-effort, no-AI meal-type guess from a recipe's title. Bulk import saves
// recipes with no meal type at all, which left the month auto-fill unable to tell
// a main from a sauce — so it dropped dips, drinks and desserts into dinner. This
// gives every recipe a type from its title, keeping the obvious non-dinners out.
//
// Precision matters less than for ingredients: there's a natural fallback here
// ("main"), so an unrecognized title lands in the dinner pool, which is almost
// always right for a recipe library. The keyword rules exist to pull the clear
// exceptions — sauces, sweets, drinks, breakfast, sides — back out of it.

interface Rule {
  type: MealType;
  keywords: string[];
}

// Ordered most- to least-specific; the first whole-word hit wins. Dessert is
// checked before drink so "eggnog cheesecake" reads as a dessert while a plain
// "eggnog" stays a drink; breakfast before side so "cinnamon roll" (a dessert
// keyword) and "dinner roll" don't fight over the bare word "roll" — which is
// why "roll" is never a keyword on its own ("chicken roll ups" is a main).
const RULES: Rule[] = [
  {
    type: 'sauce',
    keywords: [
      'sauce', 'dip', 'dressing', 'salsa', 'aioli', 'marinade', 'glaze', 'gravy',
      'ketchup', 'mustard', 'mayo', 'mayonnaise', 'pesto', 'chutney', 'jam', 'jelly',
      'syrup', 'vinaigrette', 'hummus', 'guacamole', 'relish', 'condiment', 'rub',
    ],
  },
  {
    type: 'dessert',
    keywords: [
      'cake', 'cheesecake', 'cookie', 'cookies', 'brownie', 'brownies', 'ice cream',
      'toffee', 'fudge', 'pudding', 'tart', 'truffle', 'truffles', 'frosting', 'candy',
      'donut', 'donuts', 'doughnut', 'doughnuts', 'cinnamon roll', 'cinnamon rolls',
      'custard', 'mousse', 'sorbet', 'gelato', 'eclair', 'cobbler', 'macaron', 'macarons',
      'meringue', 'dessert', 'treats', 'brittle', 'praline', 'pralines', 'cupcake',
      'cupcakes', 'pie crust', 'shortbread', 'baklava', 'tiramisu', 'panna cotta',
    ],
  },
  {
    type: 'drink',
    keywords: [
      'eggnog', 'horchata', 'smoothie', 'lemonade', 'latte', 'cocktail', 'punch',
      'cider', 'milkshake', 'shake', 'iced tea', 'margarita', 'juice', 'hot chocolate',
      'mocktail', 'sangria', 'martini', 'mojito', 'daiquiri', 'lassi', 'frappe', 'slushie',
    ],
  },
  {
    type: 'breakfast',
    keywords: [
      'pancake', 'pancakes', 'waffle', 'waffles', 'oatmeal', 'granola', 'omelet',
      'omelette', 'scramble', 'crepe', 'crepes', 'french toast', 'cereal', 'porridge',
      'frittata', 'quiche', 'bagel', 'bagels', 'muffin', 'muffins', 'hash brown',
      'hash browns', 'breakfast',
    ],
  },
  {
    type: 'side',
    keywords: [
      'biscuit', 'biscuits', 'dinner roll', 'dinner rolls', 'bread', 'cornbread',
      'tortilla', 'tortillas', 'pizza dough', 'dough', 'flatbread', 'naan', 'pita',
      'fries', 'salad', 'coleslaw', 'slaw', 'stuffing', 'side dish',
    ],
  },
  {
    type: 'snack',
    keywords: [
      'popcorn', 'trail mix', 'jerky', 'chips', 'cracker', 'crackers', 'pretzel',
      'pretzels', 'snack', 'snacks',
    ],
  },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Guess a recipe's meal type from its title, defaulting to `['main']`. Used both
 * to categorize recipes at import time and to fill in the type when the auto-fill
 * reads a still-untagged library recipe, so a sauce or dessert never lands in a
 * dinner slot.
 */
export function guessMealTypes(title: string): MealType[] {
  const lower = title.toLowerCase();
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      const re = new RegExp(`(^|[^a-z])${escapeRegExp(kw)}([^a-z]|$)`);
      if (re.test(lower)) return [rule.type];
    }
  }
  return ['main'];
}
