import { createFileRoute } from '@tanstack/react-router';
import { addMonths, addWeeks, endOfMonth, format, startOfMonth } from 'date-fns';
import { useMemo, useState } from 'react';

import { useHousehold } from '@/features/household/use-household';
import { Button } from '@/components/ui/button';
import { AutofillPanel } from '@/features/planner/components/autofill-panel';
import { BudgetBar } from '@/features/planner/components/budget-bar';
import { MonthGrid } from '@/features/planner/components/month-grid';
import { WeekView } from '@/features/planner/components/week-view';
import {
  fromISO,
  monthDays,
  monthGridDays,
  monthGridRange,
  weekDays,
  weekRange,
} from '@/features/planner/dates';
import { keyOf, type PlannerActions } from '@/features/planner/view';
import {
  useDeletePlanEntry,
  useMovePlanEntry,
  usePlanEntries,
  usePlanRealtime,
} from '@/features/planner/use-planner';
import { useMarkCooked } from '@/features/pantry/use-pantry';
import { useMonthActualSpend } from '@/features/pricing/use-actual-spend';
import { usePlannerCosts } from '@/features/pricing/use-planner-cost';
import { cn } from '@/lib/utils/cn';
import type { Slot } from '@/schemas/plan';

export const Route = createFileRoute('/_authenticated/planner')({
  component: PlannerPage,
});

type Mode = 'month' | 'week';

function PlannerPage() {
  const [mode, setMode] = useState<Mode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [addTarget, setAddTarget] = useState<{ date: string; slot: Slot } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [autofillOpen, setAutofillOpen] = useState(false);

  usePlanRealtime();

  const range = mode === 'month' ? monthGridRange(anchor) : weekRange(anchor);
  const { data, isLoading, isError } = usePlanEntries(range.start, range.end);
  const move = useMovePlanEntry();
  const del = useDeletePlanEntry();
  const markCooked = useMarkCooked();

  const entries = useMemo(() => data ?? [], [data]);
  const byKey = useMemo(() => groupBy(entries, (e) => keyOf(e.date, e.slot)), [entries]);
  const byDate = useMemo(() => groupBy(entries, (e) => e.date), [entries]);

  // Budget rollup is always the calendar month of the anchor (independent of the
  // week/month toggle), compared against the household goal.
  const { household } = useHousehold();
  const monthStart = format(startOfMonth(anchor), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(anchor), 'yyyy-MM-dd');
  const { data: monthData } = usePlanEntries(monthStart, monthEnd);
  const monthEntries = useMemo(() => monthData ?? [], [monthData]);
  const monthCosts = usePlannerCosts(monthEntries);
  const occupied = useMemo(
    () => new Set(monthEntries.map((e) => keyOf(e.date, e.slot))),
    [monthEntries],
  );
  const actual = useMonthActualSpend(monthStart, monthEnd);
  const viewCosts = usePlannerCosts(entries);

  const actions: PlannerActions = {
    addTarget,
    movingId,
    openAdd: (date, slot) => {
      setMovingId(null);
      setAddTarget({ date, slot });
    },
    closeAdd: () => setAddTarget(null),
    startMove: (id) => {
      setAddTarget(null);
      setMovingId(id);
    },
    moveHere: (date, slot) => {
      if (movingId) move.mutate({ id: movingId, date, slot });
      setMovingId(null);
    },
    remove: (id) => del.mutate(id),
  };

  const step = (dir: 1 | -1) =>
    setAnchor((a) => (mode === 'month' ? addMonths(a, dir) : addWeeks(a, dir)));

  const title =
    mode === 'month'
      ? format(anchor, 'MMMM yyyy')
      : `${format(fromISO(weekRange(anchor).start), 'MMM d')} – ${format(
          fromISO(weekRange(anchor).end),
          'MMM d',
        )}`;

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => step(-1)} aria-label="Previous">
            ‹
          </Button>
          <h1 className="min-w-40 text-center text-lg font-semibold">{title}</h1>
          <Button variant="outline" size="sm" onClick={() => step(1)} aria-label="Next">
            ›
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setAutofillOpen(true)}>
            Auto-fill month
          </Button>
          <div className="flex rounded-md border p-0.5">
            {(['week', 'month'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'rounded px-3 py-1 text-sm capitalize',
                  mode === m ? 'bg-primary text-primary-foreground' : '',
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <BudgetBar
        monthLabel={format(anchor, 'MMMM')}
        projectedCents={monthCosts.totalCents}
        actualCents={actual.actualCents}
        budgetCents={household?.monthlyBudgetCents ?? null}
        unpricedMeals={monthCosts.unpricedMeals}
        hasStore={!!monthCosts.storeId || !!actual.storeId}
        isLoading={monthCosts.isLoading || actual.isLoading}
      />

      {movingId && (
        <div className="bg-muted/50 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span>Moving an entry — tap “Move here” on a slot.</span>
          <Button variant="ghost" size="sm" onClick={() => setMovingId(null)}>
            Cancel
          </Button>
        </div>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Loading plan…</p>}
      {isError && <p className="text-destructive text-sm">Couldn’t load the plan.</p>}

      {mode === 'month' ? (
        <MonthGrid
          anchor={anchor}
          days={monthGridDays(anchor)}
          entriesByDate={byDate}
          onSelectDay={(date) => {
            setAnchor(fromISO(date));
            setMode('week');
          }}
        />
      ) : (
        <WeekView
          days={weekDays(anchor)}
          entriesByKey={byKey}
          actions={actions}
          costForEntry={(e) => {
            const c = viewCosts.costForEntry(e);
            return { total: c.cents, perServing: c.perServingCents };
          }}
          onToggleCooked={(e) => markCooked.mutate({ entry: e, cooked: !e.cookedAt })}
        />
      )}

      {autofillOpen && (
        <AutofillPanel
          monthLabel={format(anchor, 'MMMM')}
          days={monthDays(anchor)}
          occupied={occupied}
          onClose={() => setAutofillOpen(false)}
          onDone={() => setAutofillOpen(false)}
        />
      )}
    </main>
  );
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}
