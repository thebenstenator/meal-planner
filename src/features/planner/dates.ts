import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
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
