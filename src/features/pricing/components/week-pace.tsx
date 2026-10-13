import { format, parseISO } from 'date-fns';

import { daysLeftInWeek, weekAllowanceCents, weekPhase } from '@/features/pricing/pacing';
import { useSpendInRange } from '@/features/pricing/use-spend-range';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format-currency';

interface Props {
  weekStart: string; // yyyy-MM-dd
  weekEnd: string;
  monthlyBudgetCents: number;
  /** Recipe cost of the week's planned meals — what a future week is measured by. */
  plannedCents: number;
}

/**
 * The week's slice of the monthly budget, and how it's going: spent so far for
 * this week or a past one, planned meals for a week ahead (nothing's spent yet).
 * Same spend as everywhere else — trips, open checked items, eating out.
 */
export function WeekPace({ weekStart, weekEnd, monthlyBudgetCents, plannedCents }: Props) {
  const spend = useSpendInRange(weekStart, weekEnd);
  if (spend.isLoading) return null;

  const today = format(new Date(), 'yyyy-MM-dd');
  const phase = weekPhase(weekStart, weekEnd, today);
  const allowance = weekAllowanceCents(weekStart, weekEnd, monthlyBudgetCents);
  const spent = [...spend.byMonth.values()].reduce((s, c) => s + c, 0);
  const measured = phase === 'future' ? plannedCents : spent;
  const left = allowance - measured;
  const daysLeft = daysLeftInWeek(weekEnd, today);

  const label =
    phase === 'current' ? 'This week' : `Week of ${format(parseISO(weekStart), 'MMM d')}`;
  const verb = phase === 'future' ? 'planned' : 'spent';

  return (
    <p className="text-sm" data-testid="week-pace">
      <span className="font-medium">{label}:</span>{' '}
      <span className="tabular-nums">
        {formatCurrency(measured)} {verb} of {formatCurrency(allowance)}
      </span>
      <span className={cn(left < 0 ? 'text-destructive' : 'text-emerald-600')}>
        {' · '}
        {left < 0 ? `${formatCurrency(-left)} over` : `${formatCurrency(left)} left`}
      </span>
      {phase === 'current' && daysLeft > 0 && (
        <span className="text-muted-foreground">
          {' · '}
          {daysLeft} day{daysLeft === 1 ? '' : 's'} to go
        </span>
      )}
    </p>
  );
}
