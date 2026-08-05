import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import type { PlanEntry } from '@/features/planner/api';
import { AddEntryPanel } from '@/features/planner/components/add-entry-panel';
import { EntryChip } from '@/features/planner/components/entry-chip';
import { fromISO } from '@/features/planner/dates';
import { keyOf, type PlannerActions } from '@/features/planner/view';
import { SLOTS, type Slot } from '@/schemas/plan';

interface Props {
  days: string[];
  entriesByKey: Map<string, PlanEntry[]>;
  actions: PlannerActions;
  costForEntry?: (entry: PlanEntry) => number | null;
}

export function WeekView({ days, entriesByKey, actions, costForEntry }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((date) => (
        <div key={date} className="rounded-lg border">
          <div className="border-b px-3 py-2 text-sm font-medium">
            {format(fromISO(date), 'EEE MMM d')}
          </div>
          <div className="space-y-2 p-2">
            {SLOTS.map((slot) => (
              <SlotCell
                key={slot}
                date={date}
                slot={slot}
                entries={entriesByKey.get(keyOf(date, slot)) ?? []}
                actions={actions}
                costForEntry={costForEntry}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SlotCell({
  date,
  slot,
  entries,
  actions,
  costForEntry,
}: {
  date: string;
  slot: Slot;
  entries: PlanEntry[];
  actions: PlannerActions;
  costForEntry?: (entry: PlanEntry) => number | null;
}) {
  const isAdding =
    actions.addTarget?.date === date && actions.addTarget?.slot === slot;
  const moving = actions.movingId;

  return (
    <div>
      <div className="text-muted-foreground mb-1 text-[11px] font-medium uppercase tracking-wide">
        {slot}
      </div>
      <div className="space-y-1">
        {entries.map((entry) => (
          <EntryChip
            key={entry.id}
            entry={entry}
            costCents={costForEntry?.(entry) ?? null}
            isMoving={moving === entry.id}
            onStartMove={() => actions.startMove(entry.id)}
            onRemove={() => actions.remove(entry.id)}
          />
        ))}
      </div>

      {moving ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1 h-7 w-full text-xs"
          onClick={() => actions.moveHere(date, slot)}
        >
          Move here
        </Button>
      ) : (
        <button
          type="button"
          aria-label={`Add to ${slot} on ${date}`}
          className="text-muted-foreground hover:text-foreground mt-1 w-full rounded border border-dashed py-1 text-xs"
          onClick={() => actions.openAdd(date, slot)}
        >
          + add
        </button>
      )}

      {isAdding && <AddEntryPanel date={date} slot={slot} onClose={actions.closeAdd} />}
    </div>
  );
}
