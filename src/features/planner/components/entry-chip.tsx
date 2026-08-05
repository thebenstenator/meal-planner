import { Badge } from '@/components/ui/badge';
import type { PlanEntry } from '@/features/planner/api';
import { entryLabel } from '@/features/planner/view';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format-currency';
import { PLAN_KIND_LABELS } from '@/schemas/plan';

interface Props {
  entry: PlanEntry;
  costCents?: number | null;
  perServingCents?: number | null;
  isMoving: boolean;
  onStartMove: () => void;
  onRemove: () => void;
}

export function EntryChip({
  entry,
  costCents,
  perServingCents,
  isMoving,
  onStartMove,
  onRemove,
}: Props) {
  const nonMeal = entry.kind === 'leftovers' || entry.kind === 'eating_out';
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-1 rounded border px-2 py-1 text-xs',
        isMoving ? 'border-primary ring-primary/40 ring-2' : 'bg-background',
        nonMeal && 'text-muted-foreground',
      )}
    >
      <span className="min-w-0 truncate">{entryLabel(entry)}</span>
      <div className="flex shrink-0 items-center gap-1">
        {costCents != null && (
          <span className="text-muted-foreground flex flex-col items-end leading-tight tabular-nums">
            <span>{formatCurrency(costCents)}</span>
            {perServingCents != null && (
              <span className="text-[10px]">{formatCurrency(perServingCents)}/sv</span>
            )}
          </span>
        )}
        {nonMeal && <Badge variant="outline">{PLAN_KIND_LABELS[entry.kind]}</Badge>}
        <button
          type="button"
          aria-label="Move entry"
          className="text-muted-foreground hover:text-foreground"
          onClick={onStartMove}
        >
          ↔
        </button>
        <button
          type="button"
          aria-label="Remove entry"
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
