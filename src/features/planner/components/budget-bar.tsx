import { Link } from '@tanstack/react-router';

import { ForecastLine } from '@/features/pricing/components/forecast-line';
import type { MonthForecastResult } from '@/features/pricing/use-month-forecast';
import { formatCurrency } from '@/lib/utils/format-currency';

interface Props {
  monthLabel: string;
  /** Consumption cost of planned meals this month (a forward estimate). */
  projectedCents: number;
  /** Logged trips plus open checked items this month (actual money spent). */
  actualCents: number;
  budgetCents: number | null;
  unpricedMeals: number;
  /**
   * Whether there's anything to track: a priced store, or spend recorded without
   * one (paid prices, logged trips, eating out). False shows the set-up nudge.
   */
  canTrack: boolean;
  isLoading: boolean;
  /** Where the month is headed; replaces the planned line for current/future months. */
  forecast: MonthForecastResult;
}

/**
 * Month-level budget summary for the planner. Compares ACTUAL spend against the
 * household goal, and — for a month still in progress — FORECASTS where it'll
 * land: spent + still on lists + upcoming meals no list covers yet (ADR 0017).
 */
export function BudgetBar({
  monthLabel,
  projectedCents,
  actualCents,
  budgetCents,
  unpricedMeals,
  canTrack,
  isLoading,
  forecast,
}: Props) {
  if (isLoading) return null;

  const outlook =
    // Only forecast when more is coming than is already spent; otherwise the
    // projection just repeats the line above.
    forecast.phase === 'past' ||
    forecast.isLoading ||
    forecast.projectedCents <= forecast.spentCents ? (
      <span className="text-muted-foreground text-xs">
        {formatCurrency(projectedCents)} planned from meals
        {unpricedMeals > 0 && ` · ${unpricedMeals} meal${unpricedMeals === 1 ? '' : 's'} not priced`}
      </span>
    ) : (
      <ForecastLine forecast={forecast} budgetCents={budgetCents} monthLabel={monthLabel} />
    );

  // No prices to work from at all — nudge toward setup rather than showing $0.
  if (!canTrack) {
    return (
      <div className="bg-muted/40 rounded-lg border p-3 text-sm">
        <span className="text-muted-foreground">Set a default store and prices to track spend. </span>
        <Link to="/stores" className="underline">
          Set up pricing
        </Link>
      </div>
    );
  }

  if (budgetCents == null) {
    return (
      <div className="space-y-1 rounded-lg border p-3 text-sm">
        <div>
          <span className="font-medium">{formatCurrency(actualCents)}</span>{' '}
          <span className="text-muted-foreground">spent · {monthLabel}</span>
          {'. '}
          <Link to="/household/settings" className="underline">
            Set a monthly budget
          </Link>
        </div>
        {outlook}
      </div>
    );
  }

  const remaining = budgetCents - actualCents;
  const over = remaining < 0;
  const pct = budgetCents > 0 ? Math.min(100, Math.round((actualCents / budgetCents) * 100)) : 0;

  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid="budget-bar">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">
          {formatCurrency(actualCents)} spent{' '}
          <span className="text-muted-foreground font-normal">
            of {formatCurrency(budgetCents)} · {monthLabel}
          </span>
        </span>
        <span className={over ? 'text-destructive font-medium' : 'text-emerald-600 font-medium'}>
          {over ? `${formatCurrency(-remaining)} over` : `${formatCurrency(remaining)} left`}
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={over ? 'bg-destructive h-full' : 'bg-emerald-500 h-full'}
          style={{ width: `${over ? 100 : pct}%` }}
        />
      </div>
      <div>{outlook}</div>
    </div>
  );
}
