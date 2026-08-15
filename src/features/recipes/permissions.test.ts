import { describe, expect, it } from 'vitest';

import {
  canDeleteRecipe,
  canEditRecipe,
  canFavoriteRecipe,
  type RecipePerm,
} from '@/features/recipes/permissions';

const owner: RecipePerm['myPool'] = { id: 'pool1', role: 'owner' };
const member: RecipePerm['myPool'] = { id: 'pool1', role: 'member' };

describe('recipe permissions', () => {
  it('private recipe: creator can do everything, nobody else sees it (n/a)', () => {
    const mine: RecipePerm = { ownedByMe: true, recipePoolId: null, myPool: null };
    expect(canEditRecipe(mine)).toBe(true);
    expect(canDeleteRecipe(mine)).toBe(true);
    expect(canFavoriteRecipe(mine)).toBe(true);
  });

  it('pool recipe I added: I can edit + favorite, but only the owner deletes', () => {
    const myAddition: RecipePerm = { ownedByMe: true, recipePoolId: 'pool1', myPool: member };
    expect(canEditRecipe(myAddition)).toBe(true);
    expect(canFavoriteRecipe(myAddition)).toBe(true);
    expect(canDeleteRecipe(myAddition)).toBe(false); // owner-only delete
  });

  it("pool recipe someone else added: a member can't edit/delete/favorite it", () => {
    const theirs: RecipePerm = { ownedByMe: false, recipePoolId: 'pool1', myPool: member };
    expect(canEditRecipe(theirs)).toBe(false);
    expect(canDeleteRecipe(theirs)).toBe(false);
    expect(canFavoriteRecipe(theirs)).toBe(false);
  });

  it('pool owner can edit + delete anything in the pool, but favorites stay personal', () => {
    const theirsAsOwner: RecipePerm = { ownedByMe: false, recipePoolId: 'pool1', myPool: owner };
    expect(canEditRecipe(theirsAsOwner)).toBe(true);
    expect(canDeleteRecipe(theirsAsOwner)).toBe(true);
    expect(canFavoriteRecipe(theirsAsOwner)).toBe(false); // not the creator
  });
});
