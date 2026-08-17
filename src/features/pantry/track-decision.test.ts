import { describe, expect, it } from 'vitest';

import { shouldTrackInPantry, type TrackInput } from '@/features/pantry/track-decision';

const item = (over: Partial<TrackInput>): TrackInput => ({
  canonicalId: 'c1',
  category: 'pantry',
  displayName: 'rice',
  ...over,
});

describe('shouldTrackInPantry', () => {
  const noPrefs = {};

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
      shouldTrackInPantry(item({ category: 'household', displayName: 'aluminum foil' }), {
        c1: true,
      }),
    ).toBe(true);
    // Never-track a food the heuristic would have added.
    expect(shouldTrackInPantry(item({ displayName: 'rice' }), { c1: false })).toBe(false);
  });

  // Prefs are query data, and the query cache is persisted to localStorage. A
  // Map here survived every test but round-tripped to `{}` in the browser, so
  // `.get` threw and took the whole shopping list down on any device holding a
  // cache. Round-tripping in the test is what makes that shape a contract.
  it('survives the JSON round-trip the persisted cache puts it through', () => {
    const prefs = JSON.parse(JSON.stringify({ c1: false })) as Record<string, boolean>;
    expect(shouldTrackInPantry(item({ displayName: 'rice' }), prefs)).toBe(false);
    expect(shouldTrackInPantry(item({ canonicalId: 'c2' }), prefs)).toBe(true);
  });
});
