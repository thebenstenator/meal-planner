import { describe, expect, it } from 'vitest';

import type { PlanEntry } from '@/features/planner/api';
import {
  forecastMonth,
  monthPhase,
  remainingFrom,
  unlistedMeals,
} from '@/features/pricing/forecast';

function entry(date: string, overrides: Partial<PlanEntry> = {}): PlanEntry {
  return {
    id: `e-${date}`,
    date,
    slot: 'dinner',
    kind: 'recipe',
    recipeId: 'r1',
    recipeTitle: 'Tacos',
    note: null,
    servingsOverride: null,
    cookedAt: null,
    position: 0,
    ...overrides,
  };
}

describe('monthPhase', () => {
  it('classifies a month against today', () => {
    expect(monthPhase('2026-09-01', '2026-09-30', '2026-10-12')).toBe('past');
    expect(monthPhase('2026-10-01', '2026-10-31', '2026-10-12')).toBe('current');
    expect(monthPhase('2026-11-01', '2026-11-30', '2026-10-12')).toBe('future');
  });

  it('treats the first and last day as the current month', () => {
    expect(monthPhase('2026-10-01', '2026-10-31', '2026-10-01')).toBe('current');
    expect(monthPhase('2026-10-01', '2026-10-31', '2026-10-31')).toBe('current');
  });
});

describe('remainingFrom', () => {
  it('starts today in the current month, on the 1st in a future one', () => {
    expect(remainingFrom('2026-10-01', '2026-10-12')).toBe('2026-10-12');
    expect(remainingFrom('2026-11-01', '2026-10-12')).toBe('2026-11-01');
  });
});

describe('unlistedMeals', () => {
  const ranges = [{ start: '2026-10-12', end: '2026-10-18' }];

  it('drops meals a list already shops for, and meals already past', () => {
    const got = unlistedMeals(
      [entry('2026-10-10'), entry('2026-10-12'), entry('2026-10-18'), entry('2026-10-19')],
      ranges,
      '2026-10-12',
    );
    expect(got.map((e) => e.date)).toEqual(['2026-10-19']);
  });

  it('ignores non-recipe entries', () => {
    const got = unlistedMeals(
      [
        entry('2026-10-20', { kind: 'eating_out', recipeId: null }),
        entry('2026-10-21', { kind: 'leftovers', recipeId: null }),
        entry('2026-10-22'),
      ],
      [],
      '2026-10-12',
    );
    expect(got.map((e) => e.date)).toEqual(['2026-10-22']);
  });
});

describe('forecastMonth', () => {
  it('adds spend, to-buy and unlisted meals for a month in progress', () => {
    const f = forecastMonth('current', 42000, 9200, 10000);
    expect(f.projectedCents).toBe(61200);
  });

  it('projects exactly the spend for a finished month', () => {
    const f = forecastMonth('past', 55000, 9200, 10000);
    expect(f).toMatchObject({ projectedCents: 55000, toBuyCents: 0, plannedCents: 0 });
  });
});
