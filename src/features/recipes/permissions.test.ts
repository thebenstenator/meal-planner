import { describe, expect, it } from 'vitest';

import {
  canDeleteRecipe,
  canEditRecipe,
  canFavoriteRecipe,
  canManageSharing,
  poolsICanEvictFrom,
  type RecipePerm,
} from '@/features/recipes/permissions';

const asOwner: RecipePerm['myPools'] = [{ id: 'pool1', role: 'owner' }];
const asMember: RecipePerm['myPools'] = [{ id: 'pool1', role: 'member' }];

describe('recipe permissions', () => {
  it('private recipe: the creator can do everything', () => {
    const mine: RecipePerm = { ownedByMe: true, recipePoolIds: [], myPools: [] };
    expect(canEditRecipe(mine)).toBe(true);
    expect(canDeleteRecipe(mine)).toBe(true);
    expect(canFavoriteRecipe(mine)).toBe(true);
    expect(canManageSharing(mine)).toBe(true);
  });

  it('a recipe I shared stays mine — including deleting it', () => {
    const myAddition: RecipePerm = { ownedByMe: true, recipePoolIds: ['pool1'], myPools: asMember };
    expect(canEditRecipe(myAddition)).toBe(true);
    expect(canDeleteRecipe(myAddition)).toBe(true);
    expect(canManageSharing(myAddition)).toBe(true);
    // Unsharing your own recipe is sharing management, not eviction.
    expect(poolsICanEvictFrom(myAddition)).toEqual([]);
  });

  it("someone else's pool recipe is read-only to a member", () => {
    const theirs: RecipePerm = { ownedByMe: false, recipePoolIds: ['pool1'], myPools: asMember };
    expect(canEditRecipe(theirs)).toBe(false);
    expect(canDeleteRecipe(theirs)).toBe(false);
    expect(canFavoriteRecipe(theirs)).toBe(false);
    expect(canManageSharing(theirs)).toBe(false);
    expect(poolsICanEvictFrom(theirs)).toEqual([]);
  });

  it("a pool owner can't edit or delete someone else's recipe, only evict it", () => {
    const theirsInMyPool: RecipePerm = {
      ownedByMe: false,
      recipePoolIds: ['pool1'],
      myPools: asOwner,
    };
    expect(canEditRecipe(theirsInMyPool)).toBe(false);
    expect(canDeleteRecipe(theirsInMyPool)).toBe(false);
    expect(poolsICanEvictFrom(theirsInMyPool)).toEqual(['pool1']);
  });

  it('eviction only covers the pools you run, not every pool the recipe is in', () => {
    const shared: RecipePerm = {
      ownedByMe: false,
      recipePoolIds: ['pool1', 'pool2'],
      myPools: [
        { id: 'pool1', role: 'owner' },
        { id: 'pool2', role: 'member' },
      ],
    };
    expect(poolsICanEvictFrom(shared)).toEqual(['pool1']);
  });
});
