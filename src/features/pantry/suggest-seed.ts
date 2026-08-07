import { differenceInCalendarDays, parseISO } from 'date-fns';

/** Minimal pantry shape the seed builders need. */
export interface SeedItem {
  canonicalName: string;
  category: string | null;
  expiresOn: string | null;
}

// Categories that aren't cooking ingredients (snacks, drinks) or that the meal
// generator already assumes as free staples (spices) — dropped so they don't
// crowd out real ingredients.
const EXCLUDE_CATEGORIES = new Set(['snacks', 'beverages', 'spices']);

// Perishable categories — the "cook it before it goes bad" items we bias toward.
const PERISHABLE = new Set(['produce', 'meat', 'seafood', 'dairy', 'frozen', 'bakery']);

// Common staples the generator assumes anyway — no value spending a slot on them.
const STAPLES = new Set([
  'salt',
  'pepper',
  'black pepper',
  'oil',
  'olive oil',
  'vegetable oil',
  'canola oil',
  'cooking spray',
  'butter',
  'garlic',
  'flour',
  'all-purpose flour',
  'sugar',
  'brown sugar',
  'water',
  'baking soda',
  'baking powder',
  'soy sauce',
  'vinegar',
  'honey',
  'ketchup',
  'mustard',
  'mayonnaise',
]);

function daysUntil(today: string, dateISO: string): number {
  return differenceInCalendarDays(parseISO(dateISO), parseISO(today));
}

function isNoise(item: SeedItem): boolean {
  if (!item.canonicalName.trim()) return true;
  const cat = item.category?.toLowerCase() ?? '';
  if (EXCLUDE_CATEGORIES.has(cat)) return true;
  return STAPLES.has(item.canonicalName.trim().toLowerCase());
}

/** Higher = more worth cooking now. Expiring/expired first, then perishable. */
function seedScore(item: SeedItem, today: string): number {
  if (item.expiresOn) {
    const d = daysUntil(today, item.expiresOn);
    if (d <= 10) return 1000 - d; // expired (d<0) scores highest of all
  }
  const cat = item.category?.toLowerCase() ?? '';
  if (PERISHABLE.has(cat)) return 500;
  return 100;
}

/**
 * A focused ingredient seed for "what can I make?": drop snacks / drinks /
 * spices / obvious staples, then rank what's left by urgency (expiring first),
 * perishability, and finally shelf-stable bases — capped so the meal generator
 * gets the *useful* items instead of a raw dump of the whole pantry. Deduped by
 * name (an ingredient can sit in more than one location), deterministic order.
 */
export function pantrySuggestSeed(items: SeedItem[], today: string, limit = 30): string[] {
  const bestByName = new Map<string, number>();
  for (const item of items) {
    if (isNoise(item)) continue;
    const name = item.canonicalName.trim();
    const score = seedScore(item, today);
    bestByName.set(name, Math.max(bestByName.get(name) ?? -Infinity, score));
  }
  return [...bestByName.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}

/**
 * Just the items expiring within `withinDays` (or already expired), soonest
 * first — for a "use things expiring soon" shortcut. Deduped by name.
 */
export function expiringSoonSeed(items: SeedItem[], today: string, withinDays = 7): string[] {
  const soonestByName = new Map<string, number>();
  for (const item of items) {
    if (!item.expiresOn || !item.canonicalName.trim()) continue;
    const d = daysUntil(today, item.expiresOn);
    if (d > withinDays) continue;
    const name = item.canonicalName.trim();
    soonestByName.set(name, Math.min(soonestByName.get(name) ?? Infinity, d));
  }
  return [...soonestByName.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}
