import type { EntryCost } from '@/features/pricing/use-planner-cost';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format-currency';

/**
 * A recipe's cost per serving, compact: "$2.10/serving", with EST in front when
 * any ingredient is priced from the reference (ADR 0021). Partly priced recipes
 * get a "~" and say why on hover; an unpriced recipe renders nothing rather than
 * $0, so it never looks free.
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
  if (cost?.perServingCents == null) return null;
  const notes = [
    cost.estimated && 'EST: some prices are typical US prices, not your store’s.',
    cost.unpriced && 'Some ingredients aren’t priced yet, so it’s probably a bit more.',
  ].filter(Boolean);
  return (
    <span
      className={cn('text-muted-foreground text-xs tabular-nums', className)}
      title={notes.length > 0 ? notes.join(' ') : 'Cost per serving at your store’s prices'}
      data-testid="recipe-cost-tag"
    >
      {cost.estimated && <EstMark />}
      {cost.unpriced ? '~' : ''}
      {formatCurrency(cost.perServingCents)}/{short ? 'serv' : 'serving'}
    </span>
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
