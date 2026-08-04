import { describe, expect, it } from 'vitest';

import { monthGridDays, monthGridRange, weekDays, weekRange } from '@/features/planner/dates';

// March 2026: March 1 is a Sunday, March 31 is a Tuesday.
const march = new Date(2026, 2, 15);

describe('monthGridRange', () => {
  it('spans whole weeks around the month', () => {
    // Grid starts Sun Mar 1 and ends Sat Apr 4 (to complete the last week).
    expect(monthGridRange(march)).toEqual({ start: '2026-03-01', end: '2026-04-04' });
  });

  it('produces a whole number of weeks', () => {
    expect(monthGridDays(march).length % 7).toBe(0);
  });
});

describe('weekRange / weekDays', () => {
  it('covers Sunday..Saturday of the anchor week', () => {
    expect(weekRange(march)).toEqual({ start: '2026-03-15', end: '2026-03-21' });
  });

  it('returns 7 consecutive days', () => {
    const days = weekDays(march);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-03-15');
    expect(days[6]).toBe('2026-03-21');
  });
});
