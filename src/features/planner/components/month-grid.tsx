import { format, isSameMonth, isToday } from 'date-fns';

import type { PlanEntry } from '@/features/planner/api';
import { fromISO } from '@/features/planner/dates';
import { entryLabel } from '@/features/planner/view';
import { cn } from '@/lib/utils/cn';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  anchor: Date;
  days: string[];
  entriesByDate: Map<string, PlanEntry[]>;
  onSelectDay: (date: string) => void;
}

export function MonthGrid({ anchor, days, entriesByDate, onSelectDay }: Props) {
  return (
    <div>
      <div className="text-muted-foreground grid grid-cols-7 gap-1 pb-1 text-center text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const d = fromISO(date);
          const inMonth = isSameMonth(d, anchor);
          const entries = entriesByDate.get(date) ?? [];
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDay(date)}
              className={cn(
                'flex min-h-16 flex-col rounded border p-1 text-left align-top',
                inMonth ? 'bg-background' : 'bg-muted/40 text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'text-xs',
                  isToday(d) && 'bg-primary text-primary-foreground rounded px-1',
                )}
              >
                {format(d, 'd')}
              </span>
              <span className="mt-0.5 space-y-0.5">
                {entries.slice(0, 3).map((e) => (
                  <span key={e.id} className="block truncate text-[10px] leading-tight">
                    {entryLabel(e)}
                  </span>
                ))}
                {entries.length > 3 && (
                  <span className="text-muted-foreground block text-[10px]">
                    +{entries.length - 3} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
