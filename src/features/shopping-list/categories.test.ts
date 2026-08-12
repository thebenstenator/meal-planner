import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CATEGORIES,
  FALLBACK_CATEGORY,
  deduceCategory,
  groupByCategory,
  humanizeCategory,
  moveCategory,
  slugifyCategory,
  type ShoppingCategory,
} from '@/features/shopping-list/categories';

const categories: ShoppingCategory[] = DEFAULT_CATEGORIES.map((c) => ({
  id: c.slug,
  ...c,
}));

function item(name: string, category: string | null) {
  return { name, category };
}

describe('deduceCategory', () => {
  it('files a new item under the aisle its name implies', () => {
    expect(deduceCategory('roma tomatoes')).toBe('produce');
    expect(deduceCategory('all-purpose flour')).toBe('baking');
    expect(deduceCategory('paper towels')).toBe('household');
    expect(deduceCategory('frozen peas')).toBe('frozen');
    expect(deduceCategory('canned tuna')).toBe('canned');
  });

  it('falls back to "other" when the name says nothing', () => {
    expect(deduceCategory('florbnak')).toBe(FALLBACK_CATEGORY);
    expect(deduceCategory('')).toBe(FALLBACK_CATEGORY);
  });

  it('only ever returns a slug the default categories contain', () => {
    const slugs = new Set(DEFAULT_CATEGORIES.map((c) => c.slug));
    for (const name of [
      'dish soap',
      'cheerios',
      'ground beef',
      'sourdough bread',
      'jasmine rice',
    ]) {
      expect(slugs.has(deduceCategory(name))).toBe(true);
    }
  });
});

describe('slugifyCategory', () => {
  it('makes a stable slug from a typed name', () => {
    expect(slugifyCategory('Bulk bins')).toBe('bulk-bins');
    expect(slugifyCategory('  Baby & kids  ')).toBe('baby-kids');
    expect(slugifyCategory('Café')).toBe('cafe');
  });

  it('returns empty for a name with nothing usable in it', () => {
    expect(slugifyCategory('   ')).toBe('');
    expect(slugifyCategory('!!!')).toBe('');
  });
});

describe('humanizeCategory', () => {
  it('labels a slug with no category row behind it', () => {
    expect(humanizeCategory('bulk-bins')).toBe('Bulk bins');
    expect(humanizeCategory('')).toBe('Other');
  });
});

describe('groupByCategory', () => {
  it('groups into the household order and drops empty sections', () => {
    const sections = groupByCategory(
      [item('milk', 'dairy'), item('apples', 'produce'), item('cheddar', 'dairy')],
      categories,
    );
    expect(sections.map((s) => s.slug)).toEqual(['produce', 'dairy']);
    expect(sections[1]?.items.map((i) => i.name)).toEqual(['milk', 'cheddar']);
  });

  it('names sections from the household, not the slug', () => {
    const renamed = categories.map((c) =>
      c.slug === 'dairy' ? { ...c, name: 'The cold bit' } : c,
    );
    const sections = groupByCategory([item('milk', 'dairy')], renamed);
    expect(sections[0]?.name).toBe('The cold bit');
  });

  it('follows a reordered aisle order', () => {
    const reordered = categories.map((c) =>
      c.slug === 'dairy' ? { ...c, position: 1 } : c,
    );
    reordered.sort((a, b) => a.position - b.position);
    const sections = groupByCategory(
      [item('apples', 'produce'), item('milk', 'dairy')],
      reordered,
    );
    expect(sections.map((s) => s.slug)).toEqual(['dairy', 'produce']);
  });

  it('drops uncategorized and unknown items into the fallback bucket, last', () => {
    const sections = groupByCategory(
      [
        item('mystery', null),
        item('leftover', 'a-deleted-category'),
        item('apples', 'produce'),
      ],
      categories,
    );
    expect(sections.map((s) => s.slug)).toEqual(['produce', FALLBACK_CATEGORY]);
    expect(sections[1]?.items.map((i) => i.name)).toEqual(['mystery', 'leftover']);
  });

  it('never loses an item when the household has no fallback bucket', () => {
    const noFallback = categories.filter((c) => !c.isFallback);
    const sections = groupByCategory(
      [item('mystery', null), item('apples', 'produce')],
      noFallback,
    );
    expect(sections.flatMap((s) => s.items.map((i) => i.name)).sort()).toEqual([
      'apples',
      'mystery',
    ]);
  });
});

describe('moveCategory', () => {
  it('swaps with the neighbour and renumbers', () => {
    const moved = moveCategory(categories, 'bakery', 'up');
    expect(moved.map((c) => c.slug).slice(0, 3)).toEqual(['bakery', 'produce', 'deli']);
    expect(moved.slice(0, 3).map((c) => c.position)).toEqual([10, 20, 30]);
  });

  it('refuses a move off either end', () => {
    expect(moveCategory(categories, 'produce', 'up')).toBe(categories);
    expect(moveCategory(categories, 'household', 'down')).toBe(categories);
  });

  it('pins the fallback bucket last', () => {
    expect(moveCategory(categories, FALLBACK_CATEGORY, 'up')).toBe(categories);
    const moved = moveCategory(categories, 'household', 'up');
    expect(moved[moved.length - 1]?.slug).toBe(FALLBACK_CATEGORY);
  });
});
