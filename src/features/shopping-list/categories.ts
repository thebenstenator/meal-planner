// Shopping categories — the store sections a list is grouped by.
//
// An item stores a category *slug* (from its canonical ingredient, a guess, or
// the shopper's own pick). The household owns the registry of slugs: display
// name and aisle order. Anything filed under a slug the household no longer has
// lands in the fallback bucket, so nothing ever disappears from a list.

import { guessCategory } from '@/features/ingredients/guess-category';

export interface ShoppingCategory {
  id: string;
  slug: string;
  name: string;
  position: number;
  /** The "other" bucket: always present, renameable, not deletable. */
  isFallback: boolean;
}

/** Where anything unrecognized lands. */
export const FALLBACK_CATEGORY = 'other';

/**
 * The starter set every household gets, in the order you walk a store. Mirrors
 * `seed_shopping_categories` in the migration — keep both in sync.
 */
export const DEFAULT_CATEGORIES: Array<Omit<ShoppingCategory, 'id'>> = [
  { slug: 'produce', name: 'Produce', position: 10, isFallback: false },
  { slug: 'bakery', name: 'Bakery', position: 20, isFallback: false },
  { slug: 'deli', name: 'Deli', position: 30, isFallback: false },
  { slug: 'meat', name: 'Meat', position: 40, isFallback: false },
  { slug: 'seafood', name: 'Seafood', position: 50, isFallback: false },
  { slug: 'dairy', name: 'Dairy & eggs', position: 60, isFallback: false },
  { slug: 'frozen', name: 'Frozen', position: 70, isFallback: false },
  { slug: 'canned', name: 'Canned goods', position: 80, isFallback: false },
  { slug: 'pantry', name: 'Pantry', position: 90, isFallback: false },
  { slug: 'baking', name: 'Baking', position: 100, isFallback: false },
  { slug: 'spices', name: 'Spices', position: 110, isFallback: false },
  { slug: 'condiments', name: 'Condiments & sauces', position: 120, isFallback: false },
  { slug: 'breakfast', name: 'Breakfast', position: 130, isFallback: false },
  { slug: 'snacks', name: 'Snacks', position: 140, isFallback: false },
  { slug: 'beverages', name: 'Beverages', position: 150, isFallback: false },
  { slug: 'household', name: 'Household', position: 160, isFallback: false },
  { slug: FALLBACK_CATEGORY, name: 'Other', position: 900, isFallback: true },
];

/** Spacing between positions, so a new category can slot in later. */
export const POSITION_STEP = 10;

/** The fallback bucket sorts last, whatever else the household does. */
export const FALLBACK_POSITION = 900;

/**
 * Turn a typed category name into a stable slug ("Cleaning supplies" →
 * "cleaning-supplies"). Returns '' when nothing usable is left, which callers
 * treat as "not a valid category name".
 */
export function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Where a newly added item goes: the keyword guess when it's confident, else
 * the fallback bucket. (`guessCategory` is precision-first and returns null when
 * unsure — an item still has to land somewhere, so "other" it is.)
 */
export function deduceCategory(name: string): string {
  return guessCategory(name) ?? FALLBACK_CATEGORY;
}

/** Human label for a slug with no category row behind it ("bulk-bins" → "Bulk bins"). */
export function humanizeCategory(slug: string): string {
  const words = slug.replace(/[-_]+/g, ' ').trim();
  if (words === '') return 'Other';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface CategorySection<T> {
  slug: string;
  name: string;
  items: T[];
}

/**
 * Group items into the household's categories, in aisle order. Empty categories
 * are dropped; items whose category is missing or unknown fall into the
 * fallback bucket. Categories are assumed to arrive ordered by position (the
 * query orders them), so section order follows the household's own order.
 */
export function groupByCategory<T extends { category: string | null }>(
  items: T[],
  categories: ShoppingCategory[],
): Array<CategorySection<T>> {
  const known = new Map(categories.map((c) => [c.slug, c]));
  const fallbackSlug =
    categories.find((c) => c.isFallback)?.slug ??
    (known.has(FALLBACK_CATEGORY) ? FALLBACK_CATEGORY : undefined);

  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const slug = item.category ?? '';
    const target = known.has(slug) ? slug : (fallbackSlug ?? FALLBACK_CATEGORY);
    const bucket = buckets.get(target) ?? [];
    bucket.push(item);
    buckets.set(target, bucket);
  }

  const sections: Array<CategorySection<T>> = [];
  for (const category of categories) {
    const bucket = buckets.get(category.slug);
    if (bucket && bucket.length > 0) {
      sections.push({ slug: category.slug, name: category.name, items: bucket });
    }
    buckets.delete(category.slug);
  }
  // A household with no fallback row (shouldn't happen, but don't lose items).
  for (const [slug, bucket] of buckets) {
    sections.push({ slug, name: humanizeCategory(slug), items: bucket });
  }
  return sections;
}

/**
 * The categories reordered by moving one up or down a slot, with positions
 * renumbered. The fallback bucket is pinned to the end (you don't shop "other"
 * first), so it never moves and nothing moves past it. Returns the same array
 * when the move isn't possible.
 */
export function moveCategory(
  categories: ShoppingCategory[],
  id: string,
  direction: 'up' | 'down',
): ShoppingCategory[] {
  const movable = categories.filter((c) => !c.isFallback);
  const pinned = categories.filter((c) => c.isFallback);

  const index = movable.findIndex((c) => c.id === id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= movable.length) return categories;

  const next = [...movable];
  const moved = next[index] as ShoppingCategory;
  next[index] = next[target] as ShoppingCategory;
  next[target] = moved;

  return [
    ...next.map((c, i) => ({ ...c, position: (i + 1) * POSITION_STEP })),
    ...pinned.map((c) => ({ ...c, position: FALLBACK_POSITION })),
  ];
}
