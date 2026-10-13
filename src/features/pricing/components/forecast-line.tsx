import type { MonthForecastResult } from '@/features/pricing/use-month-forecast';
import { formatCurrency } from '@/lib/utils/format-currency';

/** "On pace for $612 · $12 over budget", and what that's made of. */
export function ForecastLine({
  forecast,
  budgetCents,
  monthLabel,
}: {
  forecast: MonthForecastResult;
  budgetCents: number | null;
  monthLabel: string;
}) {
  const variance = budgetCents == null ? null : budgetCents - forecast.projectedCents;
  const parts = [
    forecast.spentCents > 0 && `${formatCurrency(forecast.spentCents)} spent`,
    forecast.toBuyCents > 0 && `${formatCurrency(forecast.toBuyCents)} still on lists`,
    forecast.plannedCents > 0 &&
      `${formatCurrency(forecast.plannedCents)} for meals not on a list yet`,
    forecast.diningCents > 0 && `${formatCurrency(forecast.diningCents)} eating out`,
  ].filter(Boolean);

  return (
    <div className="space-y-0.5 text-xs" data-testid="forecast">
      <div>
        <span className="font-medium">
          {forecast.phase === 'current' ? 'On pace for' : 'Projected'}{' '}
          {formatCurrency(forecast.projectedCents)}
        </span>
        <span className="text-muted-foreground"> by the end of {monthLabel}</span>
        {variance != null && (
          <span className={variance < 0 ? 'text-destructive' : 'text-emerald-600'}>
            {' · '}
            {variance < 0
              ? `${formatCurrency(-variance)} over budget`
              : `${formatCurrency(variance)} under budget`}
          </span>
        )}
      </div>
      {parts.length > 1 && <div className="text-muted-foreground">{parts.join(' + ')}</div>}
      {forecast.unpricedCount > 0 && (
        <div className="text-muted-foreground">
          {forecast.unpricedCount} unpriced {forecast.unpricedCount === 1 ? 'item' : 'items'} left
          out
        </div>
      )}
    </div>
  );
}
