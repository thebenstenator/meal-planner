import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parse,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

/** Plain calendar date <-> ISO (YYYY-MM-DD). No time, no timezone (specs/10). */
export function toISO(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function fromISO(iso: string): Date {
  return parseISO(iso);
}

// Accepted hand-typed date shapes, most-specific first so a fuller match wins
// before a year-less one (date-fns ignores trailing input, so "8/20/2026" must
// hit 'M/d/yyyy' before 'M/d').
const TYPED_DATE_FORMATS = [
  'yyyy-MM-dd',
  'M/d/yyyy',
  'MM/dd/yyyy',
  'M/d/yy',
  'M-d-yyyy',
  'MMM d yyyy',
  'MMMM d yyyy',
  'MMM d',
  'MMMM d',
  'M/d',
];

/**
 * Parse a hand-typed date into ISO (yyyy-MM-dd), or null if it can't. Lets a
 * field accept "2026-08-20", "8/20/2026", "8/20", or "Aug 20" instead of forcing
 * the native date picker. Year-less inputs assume `today`'s year.
 *
 * date-fns `parse` ignores trailing characters, so "8/20/26" would wrongly match
 * 'M/d/yyyy' (year 0026). Each candidate is round-tripped — reformatted with the
 * same pattern and compared — so only a format that fully accounts for the input
 * wins, regardless of order.
 */
export function parseTypedDate(input: string, today: Date = new Date()): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const target = norm(input);
  if (!target) return null;
  for (const fmt of TYPED_DATE_FORMATS) {
    const d = parse(input.trim(), fmt, today);
    if (isValid(d) && norm(format(d, fmt)) === target) return toISO(d);
  }
  return null;
}

/** Inclusive [start, end] ISO range covering the full month-grid (whole weeks). */
export function monthGridRange(anchor: Date): { start: string; end: string } {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
  return { start: toISO(start), end: toISO(end) };
}

/** All days shown in the month grid (35 or 42), as ISO strings. */
export function monthGridDays(anchor: Date): string[] {
  const { start, end } = monthGridRange(anchor);
  return eachDayOfInterval({ start: fromISO(start), end: fromISO(end) }).map(toISO);
}

/** The calendar-month days of `anchor` (no week padding), as ISO strings. */
export function monthDays(anchor: Date): string[] {
  return eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) }).map(toISO);
}

/** Inclusive [start, end] ISO range for the week containing `anchor`. */
export function weekRange(anchor: Date): { start: string; end: string } {
  return {
    start: toISO(startOfWeek(anchor, { weekStartsOn: 0 })),
    end: toISO(endOfWeek(anchor, { weekStartsOn: 0 })),
  };
}

/** The 7 ISO days of the week containing `anchor`. */
export function weekDays(anchor: Date): string[] {
  const start = startOfWeek(anchor, { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end: endOfWeek(anchor, { weekStartsOn: 0 }) }).map(toISO);
}
