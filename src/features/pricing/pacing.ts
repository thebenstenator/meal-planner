import { addDays, differenceInCalendarDays, getDaysInMonth, parseISO } from 'date-fns';

/**
 * A week's share of the monthly budget: each day gets its month's daily rate
 * (budget ÷ days in that month), so a week spanning two months takes the right
 * share of each, and the weeks of a month add back up to its budget.
 */
export function weekAllowanceCents(start: string, end: string, monthlyBudgetCents: number): number {
  const first = parseISO(start);
  const days = differenceInCalendarDays(parseISO(end), first) + 1;
  let total = 0;
  for (let i = 0; i < days; i++) total += monthlyBudgetCents / getDaysInMonth(addDays(first, i));
  return Math.round(total);
}

export type WeekPhase = 'past' | 'current' | 'future';

export function weekPhase(start: string, end: string, today: string): WeekPhase {
  if (end < today) return 'past';
  if (start > today) return 'future';
  return 'current';
}

/** Days left in the week after today (0 on its last day). */
export function daysLeftInWeek(end: string, today: string): number {
  return Math.max(0, differenceInCalendarDays(parseISO(end), parseISO(today)));
}
