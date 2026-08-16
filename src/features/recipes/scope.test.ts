import { describe, expect, it } from 'vitest';

import { matchesScope, scopeCounts, scopeKey } from '@/features/recipes/scope';

const mine = { ownedByMe: true, cookbookIds: [] };
const mineShared = { ownedByMe: true, cookbookIds: ['cb1', 'cb2'] };
const theirs = { ownedByMe: false, cookbookIds: ['cb1'] };

describe('recipe scopes', () => {
  it('"all" is the search-everything scope', () => {
    for (const r of [mine, mineShared, theirs]) {
      expect(matchesScope(r, { kind: 'all' })).toBe(true);
    }
  });

  it('"household" is everything I created, shared or not', () => {
    expect(matchesScope(mine, { kind: 'household' })).toBe(true);
    expect(matchesScope(mineShared, { kind: 'household' })).toBe(true);
    expect(matchesScope(theirs, { kind: 'household' })).toBe(false);
  });

  it('a cookbook scope holds my contributions and everyone else’s alike', () => {
    const cb1 = { kind: 'cookbook', cookbookId: 'cb1' } as const;
    expect(matchesScope(mineShared, cb1)).toBe(true);
    expect(matchesScope(theirs, cb1)).toBe(true);
    expect(matchesScope(mine, cb1)).toBe(false);
  });

  it('a recipe in several cookbooks shows under each of them', () => {
    expect(matchesScope(mineShared, { kind: 'cookbook', cookbookId: 'cb2' })).toBe(true);
  });

  it('counts every scope in one pass, including empty cookbooks', () => {
    const counts = scopeCounts([mine, mineShared, theirs], ['cb1', 'cb2', 'cb3']);
    expect(counts).toEqual({
      all: 3,
      household: 2,
      cookbooks: { cb1: 2, cb2: 1, cb3: 0 },
    });
  });

  it('ignores cookbooks the viewer is not in', () => {
    const counts = scopeCounts([{ ownedByMe: true, cookbookIds: ['ghost'] }], ['cb1']);
    expect(counts.cookbooks).toEqual({ cb1: 0 });
  });

  it('keys scopes uniquely', () => {
    expect(scopeKey({ kind: 'all' })).toBe('all');
    expect(scopeKey({ kind: 'household' })).toBe('household');
    expect(scopeKey({ kind: 'cookbook', cookbookId: 'c1' })).toBe('cookbook:c1');
  });
});
