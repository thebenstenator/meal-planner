import { endOfMonth, format, parseISO } from 'date-fns';
import { useMemo } from 'react';

import { Loading } from '@/components/ui/loading';
import { usePlanEntries } from '@/features/planner/use-planner';
import { ForecastLine } from '@/features/pricing/components/forecast-line';
import { EATING_OUT, UNITEMIZED } from '@/features/pricing/month-summary';
import { useMonthForecast } from '@/features/pricing/use-month-forecast';
import { useMonthSummary } from '@/features/pricing/use-month-summary';
import { usePlannerCosts } from '@/features/pricing/use-planner-cost';
import { humanizeCategory } from '@/features/shopping-list/categories';
import { useShoppingCategories } from '@/features/shopping-list/use-categories';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format-currency';

interface Props {
  month: string; // yyyy-MM
  budgetCents: number | null;
  /** The month before, for a month-over-month comparison. */
  previous: { label: string; cents: number } | null;
}

/**
 * One month, end to end: what was spent against the goal, where it's headed,
 * where the money went by aisle, and which planned meals cost the most (ADR 0017).
 */
export function MonthSummaryCard({ month, budgetCents, previous }: Props) {
  const first = parseISO(`${month}-01`);
  const monthStart = format(first, 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(first), 'yyyy-MM-dd');
  const monthName = format(first, 'MMMM');

  const summary = useMonthSummary(monthStart, monthEnd);
  const { data: entries } = usePlanEntries(monthStart, monthEnd);
  const monthEntries = useMemo(() => entries ?? [], [entries]);
  const forecast = useMonthForecast(monthStart, monthEnd, monthEntries, summary.totalCents);
  const costs = usePlannerCosts(monthEntries);
  const { categories } = useShoppingCategories();

  const nameBySlug = useMemo(() => new Map(categories.map((c) => [c.slug, c.name])), [categories]);

  // Priciest recipes this month, a recipe planned three times counted three times.
  const priciest = useMemo(() => {
    const byRecipe = new Map<string, { id: string; title: string; count: number; cents: number }>();
    for (const e of monthEntries) {
      if (e.kind !== 'recipe' || !e.recipeId) continue;
      const c = costs.costForEntry(e).cents;
      if (c == null) continue;
      const row = byRecipe.get(e.recipeId) ?? {
        id: e.recipeId,
        title: e.recipeTitle ?? 'Recipe',
        count: 0,
        cents: 0,
      };
      row.count += 1;
      row.cents += c;
      byRecipe.set(e.recipeId, row);
    }
    return [...byRecipe.values()].sort((a, b) => b.cents - a.cents).slice(0, 5);
  }, [monthEntries, costs]);

  if (summary.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">
        <Loading>Loading {monthName}</Loading>
      </p>
    );
  }

  const total = summary.totalCents;
  const variance = budgetCents == null ? null : budgetCents - total;
  const delta = previous ? total - previous.cents : null;

  return (
    <section className="space-y-5 rounded-lg border p-4" data-testid="month-summary">
      <div className="space-y-1">
        <h2 className="text-muted-foreground text-sm font-medium">{format(first, 'MMMM yyyy')}</h2>
        <div className="text-3xl font-semibold tabular-nums">{formatCurrency(total)}</div>
        <p className="text-muted-foreground text-sm">
          spent
          {variance != null && (
            <>
              {` of ${formatCurrency(budgetCents!)} · `}
              <span className={variance < 0 ? 'text-destructive' : 'text-emerald-600'}>
                {variance < 0
                  ? `${formatCurrency(-variance)} over`
                  : `${formatCurrency(variance)} left`}
              </span>
            </>
          )}
          {delta != null && previous && previous.cents > 0 && (
            <>
              {' · '}
              {delta === 0
                ? `same as ${previous.label}`
                : `${formatCurrency(Math.abs(delta))} ${delta > 0 ? 'more' : 'less'} than ${previous.label}`}
            </>
          )}
        </p>
        {forecast.phase === 'current' &&
          !forecast.isLoading &&
          forecast.projectedCents > forecast.spentCents && (
          <ForecastLine forecast={forecast} budgetCents={budgetCents} monthLabel={monthName} />
        )}
      </div>

      {summary.byCategory.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Where it went</h3>
          <ul className="space-y-2.5">
            {summary.byCategory.map((row) => {
              const unitemized = row.category === UNITEMIZED;
              const name = unitemized
                ? 'Not itemized'
                : row.category === EATING_OUT
                  ? 'Eating out'
                  : (nameBySlug.get(row.category) ?? humanizeCategory(row.category));
              const pct = total > 0 ? Math.round((row.cents / total) * 100) : 0;
              return (
                <li
                  key={row.category}
                  className="space-y-1"
                  title={`${name}: ${formatCurrency(row.cents)} (${pct}% of ${monthName})`}
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={cn('truncate', unitemized && 'text-muted-foreground')}>
                      {name}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {formatCurrency(row.cents)}{' '}
                      <span className="text-muted-foreground inline-block w-9 text-right text-xs">
                        {pct}%
                      </span>
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        unitemized ? 'bg-muted-foreground/40' : 'bg-primary',
                      )}
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {summary.byCategory.some((r) => r.category === UNITEMIZED) && (
            <p className="text-muted-foreground text-xs">
              Not itemized is trip totals without item prices — tax, or a total typed in at
              checkout.
            </p>
          )}
        </div>
      )}

      {priciest.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Priciest meals</h3>
          <ul className="divide-y text-sm">
            {priciest.map((m) => (
              <li key={m.id} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="truncate">
                  {m.title}
                  {m.count > 1 && <span className="text-muted-foreground"> ×{m.count}</span>}
                </span>
                <span className="shrink-0 tabular-nums">{formatCurrency(m.cents)}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Planned this month, by the cost of the ingredients each meal uses.
          </p>
        </div>
      )}

      {summary.estimatedCents > 0 && (
        <p className="text-muted-foreground border-t pt-3 text-xs">
          {formatCurrency(summary.estimatedCents)} of this is estimated from your list prices.
          Finish a trip with the real total, or scan the receipt, to make it exact.
        </p>
      )}
    </section>
  );
}
