import { describe, expect, it } from 'vitest';

import { daysLeftInWeek, weekAllowanceCents, weekPhase } from '@/features/pricing/pacing';

describe('weekAllowanceCents', () => {
  it('gives a week inside one month seven days of its daily rate', () => {
    // October: 31 days, so $310 a month is $10 a day.
    expect(weekAllowanceCents('2026-10-11', '2026-10-17', 31000)).toBe(7000);
  });

  it('splits a week across two months by each month’s daily rate', () => {
    // $600/month: Sep 27–30 at $600/30 = $20/day ×4 = $80; Oct 1–3 at
    // $600/31 ≈ $19.35/day ×3 ≈ $58.06.
    expect(weekAllowanceCents('2026-09-27', '2026-10-03', 60000)).toBe(13806);
  });

  it('adds back up to the monthly budget over the month’s days', () => {
    const weeks: Array<[string, string]> = [
      ['2026-10-01', '2026-10-07'],
      ['2026-10-08', '2026-10-14'],
      ['2026-10-15', '2026-10-21'],
      ['2026-10-22', '2026-10-28'],
      ['2026-10-29', '2026-10-31'],
    ];
    const sum = weeks.reduce((s, [a, b]) => s + weekAllowanceCents(a, b, 50000), 0);
    expect(Math.abs(sum - 50000)).toBeLessThanOrEqual(weeks.length); // rounding only
  });
});

describe('weekPhase / daysLeftInWeek', () => {
  it('places the week against today', () => {
    expect(weekPhase('2026-10-04', '2026-10-10', '2026-10-12')).toBe('past');
    expect(weekPhase('2026-10-11', '2026-10-17', '2026-10-12')).toBe('current');
    expect(weekPhase('2026-10-18', '2026-10-24', '2026-10-12')).toBe('future');
  });

  it('counts the days after today', () => {
    expect(daysLeftInWeek('2026-10-17', '2026-10-12')).toBe(5);
    expect(daysLeftInWeek('2026-10-17', '2026-10-17')).toBe(0);
  });
});
