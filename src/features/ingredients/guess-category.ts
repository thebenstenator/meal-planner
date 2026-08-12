// Best-effort, no-AI category guess for a brand-new ingredient created during
// bulk import (or an on-the-fly "Create"). Keyword-matched and precision-first:
// it only returns a category on a confident hit, otherwise null (leave it
// uncategorized rather than mis-file it). Categories mirror the seeded set.

interface Rule {
  category: string;
  keywords: string[];
}

// Ordered most-specific → most-generic; the first rule with a whole-word hit
// wins. Multi-word keywords (e.g. "chili powder") are listed before the generic
// single word ("chili") so the specific reading takes precedence.
//
// The first two rules are aisle *modifiers*: "frozen peas" and "canned tuna" are
// shopped where the store keeps them, not with the fresh produce or seafood, so
// they're checked before the ingredient-name rules below.
const RULES: Rule[] = [
  {
    category: 'frozen',
    keywords: [
      'frozen', 'ice cream', 'popsicle', 'popsicles', 'freezer pop', 'frozen pizza',
      'ice cubes', 'sorbet', 'gelato', 'frozen waffles', 'tater tots', 'french fries',
    ],
  },
  {
    category: 'canned',
    keywords: [
      'canned', 'can of', 'tinned', 'jarred', 'tomato paste', 'tomato sauce',
      'crushed tomatoes', 'diced tomatoes', 'coconut milk', 'broth', 'stock',
      'refried beans', 'black beans', 'kidney beans', 'chickpeas', 'garbanzo beans',
      'baked beans', 'olives', 'pickles', 'evaporated milk', 'condensed milk',
    ],
  },
  {
    category: 'household',
    keywords: [
      'paper towel', 'paper towels', 'toilet paper', 'napkin', 'napkins', 'dish soap',
      'dishwasher', 'detergent', 'laundry', 'bleach', 'sponge', 'sponges', 'trash bag',
      'trash bags', 'garbage bags', 'foil', 'aluminum foil', 'plastic wrap', 'parchment paper',
      'ziploc', 'freezer bags', 'cleaner', 'disinfectant', 'soap', 'shampoo', 'toothpaste',
      'deodorant', 'tissues', 'batteries', 'light bulb', 'light bulbs', 'diapers',
    ],
  },
  {
    category: 'beverages',
    keywords: [
      'soda', 'cola', 'coke', 'pepsi', 'sprite', 'pop', 'juice', 'coffee', 'tea',
      'beer', 'wine', 'lemonade', 'gatorade', 'powerade', 'seltzer', 'sparkling water',
      'energy drink', 'soft drink', 'kombucha', 'cider', 'soda water', 'tonic', 'cocoa mix',
    ],
  },
  {
    category: 'snacks',
    keywords: [
      'chip', 'chips', 'cracker', 'crackers', 'cookie', 'cookies', 'candy', 'gummy',
      'gummies', 'pretzel', 'pretzels', 'popcorn', 'granola bar', 'protein bar', 'snack',
      'snacks', 'jerky', 'marshmallow', 'marshmallows', 'oreo', 'oreos', 'doritos',
      'cheetos', 'skittles', 'trail mix', 'fruit snacks', 'chocolate bar', 'nutella',
      'pop tart', 'pop tarts', 'twizzlers', 'goldfish', 'wafer', 'wafers',
    ],
  },
  // After snacks, so "granola bar" stays a snack.
  {
    category: 'breakfast',
    keywords: [
      'cereal', 'granola', 'pancake mix', 'waffle mix', 'oatmeal packets', 'instant oatmeal',
      'grits', 'breakfast bar', 'breakfast bars', 'toaster pastries', 'muesli',
    ],
  },
  {
    category: 'seafood',
    keywords: [
      'fish', 'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'crab', 'lobster', 'scallop',
      'scallops', 'halibut', 'anchovy', 'anchovies', 'sardine', 'sardines', 'mahi', 'catfish',
      'trout', 'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters',
    ],
  },
  {
    category: 'meat',
    keywords: [
      'chicken', 'beef', 'pork', 'turkey', 'bacon', 'sausage', 'ham', 'steak', 'lamb',
      'ground beef', 'ground turkey', 'ground pork', 'hot dog', 'hot dogs', 'pepperoni',
      'ribs', 'veal', 'bratwurst', 'chorizo', 'salami', 'prosciutto', 'brisket', 'meatball',
      'meatballs',
    ],
  },
  {
    category: 'dairy',
    keywords: [
      'milk', 'cheese', 'yogurt', 'yoghurt', 'cream', 'sour cream', 'cottage cheese',
      'mozzarella', 'cheddar', 'parmesan', 'feta', 'ricotta', 'egg', 'eggs', 'half and half',
      'creamer', 'ghee',
    ],
  },
  {
    category: 'bakery',
    keywords: [
      'bread', 'bagel', 'bagels', 'bun', 'buns', 'roll', 'rolls', 'tortilla', 'tortillas',
      'croissant', 'croissants', 'muffin', 'muffins', 'pita', 'naan', 'baguette', 'biscuit',
      'biscuits',
    ],
  },
  {
    category: 'spices',
    keywords: [
      'cinnamon', 'cumin', 'paprika', 'oregano', 'thyme', 'rosemary', 'nutmeg', 'turmeric',
      'chili powder', 'garlic powder', 'onion powder', 'cayenne', 'bay leaf', 'bay leaves',
      'peppercorn', 'peppercorns', 'seasoning', 'spice', 'spices', 'curry powder', 'chili flakes',
    ],
  },
  {
    category: 'condiments',
    keywords: [
      'ketchup', 'mustard', 'mayo', 'mayonnaise', 'syrup', 'jam', 'jelly', 'relish',
      'dressing', 'bbq sauce', 'barbecue sauce', 'hot sauce', 'salsa', 'sriracha', 'pesto',
      'marinara', 'gravy',
    ],
  },
  {
    category: 'produce',
    keywords: [
      'apple', 'apples', 'banana', 'bananas', 'lettuce', 'spinach', 'tomato', 'tomatoes',
      'onion', 'onions', 'carrot', 'carrots', 'potato', 'potatoes', 'broccoli', 'berry',
      'berries', 'strawberry', 'strawberries', 'blueberry', 'blueberries', 'raspberry',
      'lemon', 'lemons', 'lime', 'limes', 'cucumber', 'celery', 'mushroom', 'mushrooms',
      'avocado', 'avocados', 'grape', 'grapes', 'orange', 'oranges', 'zucchini', 'kale',
      'cabbage', 'cauliflower', 'ginger', 'cilantro', 'parsley', 'melon', 'watermelon',
      'peach', 'peaches', 'pear', 'pears', 'asparagus', 'squash', 'eggplant', 'radish',
      'scallion', 'scallions', 'bell pepper', 'jalapeno', 'jalapeño',
    ],
  },
  {
    category: 'baking',
    keywords: [
      'flour', 'sugar', 'baking soda', 'baking powder', 'yeast', 'cocoa', 'vanilla extract',
      'vanilla', 'chocolate chips', 'cornstarch', 'corn starch', 'sprinkles', 'food coloring',
      'shortening', 'molasses', 'pie crust', 'cake mix', 'brownie mix',
    ],
  },
  {
    category: 'pantry',
    keywords: [
      'rice', 'pasta', 'spaghetti', 'macaroni', 'penne', 'noodle', 'noodles', 'quinoa',
      'couscous', 'lentil', 'lentils', 'olive oil', 'vegetable oil', 'oil', 'vinegar',
      'soy sauce', 'honey', 'peanut butter', 'almond butter', 'almonds', 'walnuts', 'pecans',
      'cashews', 'raisins', 'salt', 'cornmeal', 'breadcrumbs', 'bread crumbs',
    ],
  },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Guess a canonical ingredient's category from its name, or null when unsure.
 * Precision over recall: an unknown ingredient stays uncategorized rather than
 * being mis-filed (a wrong category would, e.g., hide a real ingredient from the
 * "what can I make?" seed).
 */
export function guessCategory(name: string): string | null {
  const lower = name.toLowerCase();
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      const re = new RegExp(`(^|[^a-z])${escapeRegExp(kw)}([^a-z]|$)`);
      if (re.test(lower)) return rule.category;
    }
  }
  return null;
}
