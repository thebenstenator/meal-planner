import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RowMenu, type RowMenuAction } from '@/components/ui/row-menu';
import type { PlanEntry } from '@/features/planner/api';
import { useSetEntryCost } from '@/features/planner/use-planner';
import { EstMark } from '@/features/pricing/components/recipe-cost-tag';
import { entryLabel } from '@/features/planner/view';
import { centsToDollars, dollarsToCents } from '@/features/receipts/money';
import { useSetRecipeManualCost } from '@/features/recipes/use-recipes';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format-currency';
import { PLAN_KIND_LABELS } from '@/schemas/plan';

interface Props {
  entry: PlanEntry;
  costCents?: number | null;
  perServingCents?: number | null;
  /** The recipe cost uses typical US prices for some ingredients — shown EST. */
  costEstimated?: boolean;
  onToggleCooked?: () => void;
  isMoving: boolean;
  onStartMove: () => void;
  onRemove: () => void;
}

/**
 * One planned meal. The label and cost stay on the face of the chip; every action
 * — cook, set price, move, remove — lives behind a single "⋮" so the chip reads
 * cleanly on a phone instead of piling up tiny tap targets.
 */
export function EntryChip({
  entry,
  costCents,
  perServingCents,
  costEstimated = false,
  onToggleCooked,
  isMoving,
  onStartMove,
  onRemove,
}: Props) {
  const [pricing, setPricing] = useState(false);
  const nonMeal = entry.kind === 'leftovers' || entry.kind === 'eating_out';
  const cooked = !!entry.cookedAt;
  const isRecipe = entry.kind === 'recipe' && !!entry.recipeId;
  const canCook = isRecipe && !!onToggleCooked;
  const isDining = entry.kind === 'eating_out';
  // A recipe's cost comes from the planner's costing; eating out carries its own.
  const shownCents = isDining ? entry.costCents : costCents;

  const actions: RowMenuAction[] = [];
  if (canCook) {
    actions.push({ label: cooked ? 'Mark not cooked' : 'Mark cooked', onSelect: onToggleCooked! });
  }
  if (isRecipe) {
    actions.push({ label: 'Set meal price', onSelect: () => setPricing(true) });
  }
  if (isDining) {
    actions.push({
      label: entry.costCents != null ? 'Change cost' : 'Set cost',
      onSelect: () => setPricing(true),
    });
  }
  actions.push({ label: 'Move', onSelect: onStartMove });
  actions.push({ label: 'Remove', onSelect: onRemove, destructive: true });

  return (
    <div
      className={cn(
        'rounded border px-2 py-1 text-xs',
        isMoving ? 'border-primary ring-primary/40 ring-2' : 'bg-background',
        nonMeal && 'text-muted-foreground',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={cn('min-w-0 truncate', cooked && 'text-muted-foreground line-through')}>
          {cooked && '✓ '}
          {entryLabel(entry)}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {entry.kind === 'recipe' && entry.servingsOverride != null && (
            <span
              className="text-muted-foreground tabular-nums"
              title={`Scaled to ${entry.servingsOverride} servings`}
            >
              {entry.servingsOverride}sv
            </span>
          )}
          {shownCents != null && (
            <span className="text-muted-foreground flex flex-col items-end leading-tight tabular-nums">
              <span>
                {!isDining && costEstimated && <EstMark />}
                {formatCurrency(shownCents)}
              </span>
              {perServingCents != null && (
                <span className="text-[10px]">{formatCurrency(perServingCents)}/sv</span>
              )}
            </span>
          )}
          {nonMeal && <Badge variant="outline">{PLAN_KIND_LABELS[entry.kind]}</Badge>}
          <RowMenu label={`Actions for ${entryLabel(entry)}`} actions={actions} />
        </div>
      </div>

      {pricing && isDining && (
        <DiningCostEditor
          entryId={entry.id}
          currentCents={entry.costCents}
          onClose={() => setPricing(false)}
        />
      )}

      {pricing && entry.recipeId && (
        <MealPriceEditor
          recipeId={entry.recipeId}
          currentCents={costCents ?? null}
          onClose={() => setPricing(false)}
        />
      )}
    </div>
  );
}

/**
 * Inline editor for a recipe's manual meal price. Saving sets a flat price that
 * overrides the ingredient-computed cost for every plan that uses this recipe;
 * "Use ingredient cost" clears it back to the calculation.
 */
function MealPriceEditor({
  recipeId,
  currentCents,
  onClose,
}: {
  recipeId: string;
  currentCents: number | null;
  onClose: () => void;
}) {
  const setCost = useSetRecipeManualCost(recipeId);
  const [value, setValue] = useState('');

  function save() {
    const cents = dollarsToCents(value);
    if (cents == null) return;
    setCost.mutate(cents, { onSuccess: onClose });
  }

  return (
    <div
      className="mt-1 flex flex-wrap items-center gap-1 border-t pt-1"
      // The chip has no tap-to-anything behaviour, but keep edits self-contained.
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-muted-foreground">$</span>
      <Input
        autoFocus
        inputMode="decimal"
        aria-label="Meal price"
        placeholder={currentCents != null ? centsToDollars(currentCents) : '0.00'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          }
          if (e.key === 'Escape') onClose();
        }}
        className="h-7 w-20"
      />
      <Button type="button" size="sm" className="h-7" onClick={save} disabled={setCost.isPending}>
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-1"
        title="Clear the manual price and use the ingredient-based cost"
        onClick={() => setCost.mutate(null, { onSuccess: onClose })}
        disabled={setCost.isPending}
      >
        Use ingredient cost
      </Button>
    </div>
  );
}

/** Inline editor for what an eating-out meal costs; it counts toward the month's budget. */
function DiningCostEditor({
  entryId,
  currentCents,
  onClose,
}: {
  entryId: string;
  currentCents: number | null;
  onClose: () => void;
}) {
  const setCost = useSetEntryCost();
  const [value, setValue] = useState(currentCents != null ? centsToDollars(currentCents) : '');

  function save() {
    const cents = dollarsToCents(value);
    if (cents == null || cents < 0) return;
    setCost.mutate({ id: entryId, cents }, { onSuccess: onClose });
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 border-t pt-1">
      <span className="text-muted-foreground">$</span>
      <Input
        autoFocus
        inputMode="decimal"
        aria-label="Eating out cost"
        placeholder="0.00"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          }
          if (e.key === 'Escape') onClose();
        }}
        className="h-7 w-20"
      />
      <Button type="button" size="sm" className="h-7" onClick={save} disabled={setCost.isPending}>
        Save
      </Button>
      {currentCents != null && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-1"
          onClick={() => setCost.mutate({ id: entryId, cents: null }, { onSuccess: onClose })}
          disabled={setCost.isPending}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
