import { describe, expect, it } from 'vitest';

import { matchesScope, scopeCounts, scopeKey } from '@/features/recipes/scope';

const mine = { ownedByMe: true, poolIds: [] };
const mineShared = { ownedByMe: true, poolIds: ['pool1', 'pool2'] };
const theirs = { ownedByMe: false, poolIds: ['pool1'] };

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

  it('a pool scope holds my contributions and everyone else’s alike', () => {
    const pool1 = { kind: 'pool', poolId: 'pool1' } as const;
    expect(matchesScope(mineShared, pool1)).toBe(true);
    expect(matchesScope(theirs, pool1)).toBe(true);
    expect(matchesScope(mine, pool1)).toBe(false);
  });

  it('a recipe in several pools shows under each of them', () => {
    expect(matchesScope(mineShared, { kind: 'pool', poolId: 'pool2' })).toBe(true);
  });

  it('counts every scope in one pass, including empty pools', () => {
    const counts = scopeCounts([mine, mineShared, theirs], ['pool1', 'pool2', 'pool3']);
    expect(counts).toEqual({
      all: 3,
      household: 2,
      pools: { pool1: 2, pool2: 1, pool3: 0 },
    });
  });

  it('ignores pools the viewer is not in', () => {
    const counts = scopeCounts([{ ownedByMe: true, poolIds: ['ghost'] }], ['pool1']);
    expect(counts.pools).toEqual({ pool1: 0 });
  });

  it('keys scopes uniquely', () => {
    expect(scopeKey({ kind: 'all' })).toBe('all');
    expect(scopeKey({ kind: 'household' })).toBe('household');
    expect(scopeKey({ kind: 'pool', poolId: 'p1' })).toBe('pool:p1');
  });
});
