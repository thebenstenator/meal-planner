import { describe, expect, it } from 'vitest';

import { shouldTrackInPantry, type TrackInput } from '@/features/pantry/track-decision';

const item = (over: Partial<TrackInput>): TrackInput => ({
  canonicalId: 'c1',
  category: 'pantry',
  displayName: 'rice',
  ...over,
});

describe('shouldTrackInPantry', () => {
  const noPrefs = new Map<string, boolean>();

  it('tracks a plain food item by default', () => {
    expect(shouldTrackInPantry(item({}), noPrefs)).toBe(true);
  });

  it('skips unmatched items — nothing to track', () => {
    expect(shouldTrackInPantry(item({ canonicalId: null }), noPrefs)).toBe(false);
  });

  it('skips the Household aisle and non-food names by default', () => {
    expect(shouldTrackInPantry(item({ category: 'household', displayName: 'dish soap' }), noPrefs))
      .toBe(false);
    // Mis-filed as Pantry via "salt", but the name gives it away.
    expect(shouldTrackInPantry(item({ category: 'pantry', displayName: 'water softener salt' }), noPrefs))
      .toBe(false);
  });

  it('an explicit preference wins over the heuristic, both ways', () => {
    // Force-track a non-food (e.g. someone really does inventory their foil).
    expect(
      shouldTrackInPantry(
        item({ category: 'household', displayName: 'aluminum foil' }),
        new Map([['c1', true]]),
      ),
    ).toBe(true);
    // Never-track a food the heuristic would have added.
    expect(shouldTrackInPantry(item({ displayName: 'rice' }), new Map([['c1', false]]))).toBe(false);
  });
});
