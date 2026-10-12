import type { EntryCost } from '@/features/pricing/use-planner-cost';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format-currency';

/**
 * A recipe's cost per serving, compact: "$2.10/serving". Partly priced recipes
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
  return (
    <span
      className={cn('text-muted-foreground text-xs tabular-nums', className)}
      title={
        cost.unpriced
          ? 'Some ingredients aren’t priced yet, so it’s probably a bit more.'
          : 'Cost per serving at your store’s prices'
      }
      data-testid="recipe-cost-tag"
    >
      {cost.unpriced ? '~' : ''}
      {formatCurrency(cost.perServingCents)}/{short ? 'serv' : 'serving'}
    </span>
  );
}
