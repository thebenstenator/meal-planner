import type { EntryCost } from '@/features/pricing/use-planner-cost';
import { useUiStore } from '@/app/store/ui-store';
import { costForView } from '@/app/cost-view';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format-currency';

/**
 * A recipe's cost, compact, in the household's chosen view: "$1.56/serving" or
 * "$6.25 total" for the whole dish (see CostViewToggle). EST in front when any
 * ingredient is priced from the reference (ADR 0021). Partly priced recipes get
 * a "~" and say why on hover; an unpriced recipe renders nothing rather than $0,
 * so it never looks free.
 */
export function RecipeCostTag({
  cost,
  short = false,
  className,
}: {
  cost: EntryCost | undefined;
  /** "/serv" instead of "/serving", for tight rows. */
  short?: boolean;
  className?: string;
}) {
  const view = useUiStore((s) => s.costView);
  const cents = cost ? costForView(cost, view) : null;
  if (!cost || cents == null) return null;
  const notes = [
    cost.estimated && 'EST: some prices are typical US prices, not your store’s.',
    cost.unpriced && 'Some ingredients aren’t priced yet, so it’s probably a bit more.',
  ].filter(Boolean);
  return (
    <span
      className={cn('text-muted-foreground text-xs tabular-nums', className)}
      title={
        notes.length > 0
          ? notes.join(' ')
          : view === 'meal'
            ? 'Cost of the whole dish at your store’s prices'
            : 'Cost per serving at your store’s prices'
      }
      data-testid="recipe-cost-tag"
    >
      {cost.estimated && <EstMark />}
      {cost.unpriced ? '~' : ''}
      {formatCurrency(cents)}
      {view === 'meal' ? ' total' : short ? '/serv' : '/serving'}
    </span>
  );
}

/** Per serving | Whole dish — switches every recipe cost, remembered on this device. */
export function CostViewToggle({ className }: { className?: string }) {
  const view = useUiStore((s) => s.costView);
  const setView = useUiStore((s) => s.setCostView);
  return (
    <div
      role="radiogroup"
      aria-label="Show recipe costs"
      className={cn('bg-background inline-flex rounded-full border p-0.5 text-xs', className)}
    >
      {(
        [
          ['serving', 'Per serving'],
          ['meal', 'Whole dish'],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={view === value}
          onClick={() => setView(value)}
          className={cn(
            'rounded-full px-2.5 py-0.5',
            view === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * The "EST" in front of a figure priced (at least partly) from the shared
 * reference rather than the household's own store (ADR 0021).
 */
export function EstMark({ className }: { className?: string }) {
  return (
    <abbr
      title="Estimated from typical US prices — set your store’s prices for exact costs"
      className={cn('mr-1 text-[10px] font-semibold tracking-wide no-underline', className)}
    >
      EST
    </abbr>
  );
}
