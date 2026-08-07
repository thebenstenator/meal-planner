import { describe, expect, it } from 'vitest';

import { expiringSoonSeed, pantrySuggestSeed, type SeedItem } from '@/features/pantry/suggest-seed';

const today = '2026-08-30';

function item(over: Partial<SeedItem> & { canonicalName: string }): SeedItem {
  return { category: null, expiresOn: null, ...over };
}

describe('pantrySuggestSeed', () => {
  it('drops snacks, drinks, spices, and obvious staples', () => {
    const items = [
      item({ canonicalName: 'potato chips', category: 'snacks' }),
      item({ canonicalName: 'cola', category: 'beverages' }),
      item({ canonicalName: 'cumin', category: 'spices' }),
      item({ canonicalName: 'salt', category: 'pantry' }),
      item({ canonicalName: 'chicken thighs', category: 'meat' }),
    ];
    expect(pantrySuggestSeed(items, today)).toEqual(['chicken thighs']);
  });

  it('ranks expiring items first, then perishables, then shelf-stable', () => {
    const items = [
      item({ canonicalName: 'canned beans', category: 'canned' }),
      item({ canonicalName: 'carrots', category: 'produce' }),
      item({ canonicalName: 'spinach', category: 'produce', expiresOn: '2026-09-01' }), // 2 days
    ];
    expect(pantrySuggestSeed(items, today)).toEqual(['spinach', 'carrots', 'canned beans']);
  });

  it('puts already-expired items at the very top', () => {
    const items = [
      item({ canonicalName: 'fresh basil', category: 'produce', expiresOn: '2026-08-28' }), // expired
      item({ canonicalName: 'milk', category: 'dairy', expiresOn: '2026-09-02' }), // 3 days
    ];
    expect(pantrySuggestSeed(items, today)).toEqual(['fresh basil', 'milk']);
  });

  it('dedupes an ingredient stored in multiple locations, keeping its best score', () => {
    const items = [
      item({ canonicalName: 'butter substitute', category: 'dairy' }),
      item({ canonicalName: 'butter substitute', category: 'dairy', expiresOn: '2026-09-01' }),
    ];
    const seed = pantrySuggestSeed(items, today);
    expect(seed).toEqual(['butter substitute']);
  });

  it('respects the limit, keeping the highest-priority items', () => {
    const items = [
      item({ canonicalName: 'rice', category: 'pantry' }),
      item({ canonicalName: 'beef', category: 'meat' }),
      item({ canonicalName: 'kale', category: 'produce', expiresOn: '2026-08-31' }),
    ];
    expect(pantrySuggestSeed(items, today, 2)).toEqual(['kale', 'beef']);
  });
});

describe('expiringSoonSeed', () => {
  const items = [
    item({ canonicalName: 'yogurt', category: 'dairy', expiresOn: '2026-08-28' }), // expired
    item({ canonicalName: 'lettuce', category: 'produce', expiresOn: '2026-09-02' }), // 3 days
    item({ canonicalName: 'cheese', category: 'dairy', expiresOn: '2026-09-20' }), // far
    item({ canonicalName: 'rice', category: 'pantry', expiresOn: null }),
  ];

  it('returns only near-expiry items, soonest first (expired included)', () => {
    expect(expiringSoonSeed(items, today, 7)).toEqual(['yogurt', 'lettuce']);
  });

  it('is empty when nothing is close to expiring', () => {
    expect(expiringSoonSeed([items[2]!, items[3]!], today, 7)).toEqual([]);
  });
});
