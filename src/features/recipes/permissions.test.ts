import { describe, expect, it } from 'vitest';

import {
  canDeleteRecipe,
  canEditRecipe,
  canFavoriteRecipe,
  canManageSharing,
  cookbooksICanEvictFrom,
  type RecipePerm,
} from '@/features/recipes/permissions';

const asOwner: RecipePerm['myCookbooks'] = [{ id: 'cb1', role: 'owner' }];
const asMember: RecipePerm['myCookbooks'] = [{ id: 'cb1', role: 'member' }];

describe('recipe permissions', () => {
  it('private recipe: the creator can do everything', () => {
    const mine: RecipePerm = { ownedByMe: true, recipeCookbookIds: [], myCookbooks: [] };
    expect(canEditRecipe(mine)).toBe(true);
    expect(canDeleteRecipe(mine)).toBe(true);
    expect(canFavoriteRecipe(mine)).toBe(true);
    expect(canManageSharing(mine)).toBe(true);
  });

  it('a recipe I shared stays mine — including deleting it', () => {
    const myAddition: RecipePerm = {
      ownedByMe: true,
      recipeCookbookIds: ['cb1'],
      myCookbooks: asMember,
    };
    expect(canEditRecipe(myAddition)).toBe(true);
    expect(canDeleteRecipe(myAddition)).toBe(true);
    expect(canManageSharing(myAddition)).toBe(true);
    // Unsharing your own recipe is sharing management, not eviction.
    expect(cookbooksICanEvictFrom(myAddition)).toEqual([]);
  });

  it("someone else's cookbook recipe is read-only to a member", () => {
    const theirs: RecipePerm = {
      ownedByMe: false,
      recipeCookbookIds: ['cb1'],
      myCookbooks: asMember,
    };
    expect(canEditRecipe(theirs)).toBe(false);
    expect(canDeleteRecipe(theirs)).toBe(false);
    expect(canFavoriteRecipe(theirs)).toBe(false);
    expect(canManageSharing(theirs)).toBe(false);
    expect(cookbooksICanEvictFrom(theirs)).toEqual([]);
  });

  it("a cookbook owner can't edit or delete someone else's recipe, only evict it", () => {
    const theirsInMyCookbook: RecipePerm = {
      ownedByMe: false,
      recipeCookbookIds: ['cb1'],
      myCookbooks: asOwner,
    };
    expect(canEditRecipe(theirsInMyCookbook)).toBe(false);
    expect(canDeleteRecipe(theirsInMyCookbook)).toBe(false);
    expect(cookbooksICanEvictFrom(theirsInMyCookbook)).toEqual(['cb1']);
  });

  it('eviction only covers the cookbooks you run, not every cookbook the recipe is in', () => {
    const shared: RecipePerm = {
      ownedByMe: false,
      recipeCookbookIds: ['cb1', 'cb2'],
      myCookbooks: [
        { id: 'cb1', role: 'owner' },
        { id: 'cb2', role: 'member' },
      ],
    };
    expect(cookbooksICanEvictFrom(shared)).toEqual(['cb1']);
  });
});
