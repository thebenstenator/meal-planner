import { Link } from '@tanstack/react-router';

import { formatCurrency } from '@/lib/utils/format-currency';

interface Props {
  monthLabel: string;
  /** Consumption cost of planned meals this month (a forward estimate). */
  projectedCents: number;
  /** Purchase cost of checked-off items this month (actual money spent). */
  actualCents: number;
  budgetCents: number | null;
  unpricedMeals: number;
  hasStore: boolean;
  isLoading: boolean;
}

/**
 * Month-level budget summary for the planner. Compares ACTUAL spend (checked-off
 * shopping items, purchase-based) against the household goal, and shows PLANNED
 * spend (consumption cost of planned meals) as a forward-looking estimate.
 */
export function BudgetBar({
  monthLabel,
  projectedCents,
  actualCents,
  budgetCents,
  unpricedMeals,
  hasStore,
  isLoading,
}: Props) {
  if (isLoading) return null;

  const plannedLine = (
    <span className="text-muted-foreground text-xs">
      {formatCurrency(projectedCents)} planned from meals
      {unpricedMeals > 0 && ` · ${unpricedMeals} meal${unpricedMeals === 1 ? '' : 's'} not priced`}
    </span>
  );

  // No prices to work from at all — nudge toward setup rather than showing $0.
  if (!hasStore) {
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
        {plannedLine}
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
      <div>{plannedLine}</div>
    </div>
  );
}
