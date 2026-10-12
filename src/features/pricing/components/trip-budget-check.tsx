import { endOfMonth, format, startOfMonth } from 'date-fns';
import type { ReactNode } from 'react';

import { useHousehold } from '@/features/household/use-household';
import { useMonthActualSpend } from '@/features/pricing/use-actual-spend';
import { useListPricing } from '@/features/pricing/use-list-pricing';
import type { ShoppingItem } from '@/features/shopping-list/api';
import { formatCurrency } from '@/lib/utils/format-currency';

/**
 * Before the trip: what's still to buy on this list against what's left of this
 * month's budget. "Left" is the goal minus what's been spent so far — which
 * already includes anything checked off here, so only unchecked items count as
 * still to buy (ADR 0016). Renders nothing without a budget or with nothing left
 * to buy.
 */
export function TripBudgetCheck({ items }: { items: ShoppingItem[] }) {
  const { household } = useHousehold();
  const budgetCents = household?.monthlyBudgetCents ?? null;
  const now = new Date();
  const spent = useMonthActualSpend(
    format(startOfMonth(now), 'yyyy-MM-dd'),
    format(endOfMonth(now), 'yyyy-MM-dd'),
  );
  const pricing = useListPricing(items);

  if (budgetCents == null || spent.isLoading || pricing.isLoading) return null;

  let toBuyCents = 0;
  let unpriced = 0;
  for (const it of items) {
    if (it.isChecked) continue;
    const cents = it.actualCostCents ?? pricing.byItemId.get(it.id)?.estimatedCents ?? null;
    if (cents == null) unpriced += 1;
    else toBuyCents += cents;
  }
  if (toBuyCents === 0) return null;

  const month = format(now, 'MMMM');
  const leftCents = budgetCents - spent.actualCents;
  const afterCents = leftCents - toBuyCents;

  let verdict: ReactNode;
  if (leftCents <= 0) {
    verdict = (
      <span className="text-destructive">
        {month}’s budget is already used up
        {leftCents < 0 && ` (${formatCurrency(-leftCents)} over)`}
      </span>
    );
  } else if (afterCents < 0) {
    verdict = (
      <span className="text-destructive">
        {formatCurrency(-afterCents)} more than the {formatCurrency(leftCents)} left in {month}’s
        budget
      </span>
    );
  } else {
    verdict = (
      <span className="text-emerald-600">
        leaves {formatCurrency(afterCents)} of {month}’s budget
      </span>
    );
  }

  return (
    <p className="text-sm" data-testid="trip-budget-check">
      <span className="font-medium">~{formatCurrency(toBuyCents)}</span>
      <span className="text-muted-foreground"> still to buy · </span>
      {verdict}
      {unpriced > 0 && (
        <span className="text-muted-foreground">
          {' '}
          ({unpriced} unpriced {unpriced === 1 ? 'item' : 'items'} not counted)
        </span>
      )}
    </p>
  );
}
