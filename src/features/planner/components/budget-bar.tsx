import { Link } from '@tanstack/react-router';

import { formatCurrency } from '@/lib/utils/format-currency';

interface Props {
  monthLabel: string;
  projectedCents: number;
  budgetCents: number | null;
  unpricedMeals: number;
  hasStore: boolean;
  isLoading: boolean;
}

/**
 * Month-level budget summary for the planner: projected consumption spend across
 * planned meals vs. the household's monthly goal, with an over/under variance.
 */
export function BudgetBar({
  monthLabel,
  projectedCents,
  budgetCents,
  unpricedMeals,
  hasStore,
  isLoading,
}: Props) {
  if (isLoading) return null;

  const caveat =
    unpricedMeals > 0 ? (
      <span className="text-muted-foreground text-xs">
        {' '}
        · {unpricedMeals} meal{unpricedMeals === 1 ? '' : 's'} not yet priced
      </span>
    ) : null;

  // No prices to work from at all — nudge toward setup rather than showing $0.
  if (!hasStore) {
    return (
      <div className="bg-muted/40 rounded-lg border p-3 text-sm">
        <span className="text-muted-foreground">Set a default store and prices to see projected spend. </span>
        <Link to="/stores" className="underline">
          Set up pricing
        </Link>
      </div>
    );
  }

  if (budgetCents == null) {
    return (
      <div className="rounded-lg border p-3 text-sm">
        <span className="font-medium">{formatCurrency(projectedCents)}</span>{' '}
        <span className="text-muted-foreground">projected for {monthLabel}</span>
        {caveat}
        {'. '}
        <Link to="/household/settings" className="underline">
          Set a monthly budget
        </Link>
      </div>
    );
  }

  const remaining = budgetCents - projectedCents;
  const over = remaining < 0;
  const pct = budgetCents > 0 ? Math.min(100, Math.round((projectedCents / budgetCents) * 100)) : 0;

  return (
    <div className="space-y-2 rounded-lg border p-3" data-testid="budget-bar">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">
          {formatCurrency(projectedCents)}{' '}
          <span className="text-muted-foreground font-normal">
            of {formatCurrency(budgetCents)} · {monthLabel}
          </span>
        </span>
        <span className={over ? 'text-destructive font-medium' : 'text-emerald-600 font-medium'}>
          {over
            ? `${formatCurrency(-remaining)} over`
            : `${formatCurrency(remaining)} left`}
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={over ? 'bg-destructive h-full' : 'bg-emerald-500 h-full'}
          style={{ width: `${over ? 100 : pct}%` }}
        />
      </div>
      {caveat && <div>{caveat}</div>}
    </div>
  );
}
