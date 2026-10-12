import { createFileRoute, Link } from '@tanstack/react-router';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { MonthSummaryCard } from '@/features/pricing/components/month-summary-card';
import { monthLabel, useSpendHistory } from '@/features/pricing/use-spend-history';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format-currency';

export const Route = createFileRoute('/_authenticated/spending')({
  component: SpendingPage,
});

function SpendingPage() {
  const { rows, budgetCents, storeId, isLoading } = useSpendHistory(6);
  // The month whose summary is open; null = the current (last) month.
  const [picked, setPicked] = useState<string | null>(null);

  const scale = Math.max(1, ...rows.map((r) => r.actualCents), budgetCents ?? 0);
  const budgetPct = budgetCents ? (budgetCents / scale) * 100 : null;
  const anySpend = rows.some((r) => r.actualCents > 0);

  const selected = picked ?? rows[rows.length - 1]?.month ?? null;
  const selectedIdx = rows.findIndex((r) => r.month === selected);
  const prevRow = selectedIdx > 0 ? rows[selectedIdx - 1] : null;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Spending</h1>
          <p className="text-muted-foreground text-sm">
            Actual grocery spend by month, from logged trips and items you’ve checked off. Tap a
            month for the breakdown.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/receipts">Scan receipt</Link>
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm"><Loading>Loading</Loading></p>}

      {!isLoading && !storeId && !anySpend && (
        <div className="bg-muted/40 rounded-lg border p-4 text-sm">
          <span className="text-muted-foreground">
            Scan a receipt or set a default store and prices to track spend.{' '}
          </span>
          <Link to="/stores" className="underline">
            Set up pricing
          </Link>
        </div>
      )}

      {!isLoading && (storeId || anySpend) && (
        <>
          {/* Bar chart — each month is a button that opens its summary. */}
          <div className="rounded-lg border p-4">
            <div className="relative flex h-48 items-end justify-between gap-2">
              {budgetPct != null && (
                <div
                  className="border-muted-foreground/50 pointer-events-none absolute inset-x-0 border-t border-dashed"
                  style={{ bottom: `${Math.min(100, budgetPct)}%` }}
                  aria-hidden
                >
                  <span className="text-muted-foreground bg-background absolute -top-2 right-0 pl-1 text-[10px]">
                    budget {formatCurrency(budgetCents!)}
                  </span>
                </div>
              )}
              {rows.map((r) => {
                const over = budgetCents != null && r.actualCents > budgetCents;
                const heightPct = (r.actualCents / scale) * 100;
                const isSelected = r.month === selected;
                return (
                  <button
                    key={r.month}
                    type="button"
                    onClick={() => setPicked(r.month)}
                    aria-pressed={isSelected}
                    aria-label={`${monthLabel(r.month)}: ${formatCurrency(r.actualCents)}`}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  >
                    <span className="text-[10px] tabular-nums">
                      {r.actualCents > 0 ? formatCurrency(r.actualCents) : ''}
                    </span>
                    <div
                      className={cn(
                        'w-full rounded-t',
                        over ? 'bg-destructive' : 'bg-emerald-500',
                        r.actualCents === 0 && 'bg-muted',
                        !isSelected && 'opacity-50',
                      )}
                      style={{ height: `${Math.max(heightPct, r.actualCents > 0 ? 2 : 0)}%` }}
                    />
                    <span
                      className={cn(
                        'text-xs',
                        isSelected ? 'font-semibold' : 'text-muted-foreground',
                      )}
                    >
                      {r.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {!anySpend && (
            <p className="text-muted-foreground text-sm">
              No spend recorded yet. Scan a receipt or check off items on a shopping list and
              they’ll show up here.
            </p>
          )}

          {selected && (
            <MonthSummaryCard
              key={selected}
              month={selected}
              budgetCents={budgetCents}
              previous={
                prevRow
                  ? { label: format(parseISO(`${prevRow.month}-01`), 'MMMM'), cents: prevRow.actualCents }
                  : null
              }
            />
          )}

          {/* Per-month table — the chart's data, and another way to pick a month. */}
          <ul className="divide-y rounded-lg border">
            {[...rows].reverse().map((r) => {
              const variance = budgetCents == null ? null : budgetCents - r.actualCents;
              return (
                <li key={r.month}>
                  <button
                    type="button"
                    onClick={() => setPicked(r.month)}
                    aria-pressed={r.month === selected}
                    className={cn(
                      'flex w-full items-center justify-between px-4 py-2 text-left text-sm',
                      r.month === selected && 'bg-muted/50',
                    )}
                  >
                    <span>{r.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium tabular-nums">{formatCurrency(r.actualCents)}</span>
                      {variance != null && r.actualCents > 0 && (
                        <span
                          className={cn(
                            'w-20 text-right text-xs',
                            variance < 0 ? 'text-destructive' : 'text-emerald-600',
                          )}
                        >
                          {variance < 0
                            ? `${formatCurrency(-variance)} over`
                            : `${formatCurrency(variance)} left`}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
