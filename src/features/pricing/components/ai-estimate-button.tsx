import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Loading } from '@/components/ui/loading';
import { useEntitlement } from '@/features/billing/use-entitlement';
import { useHousehold } from '@/features/household/use-household';
import { pricingKeys, requestAiEstimates } from '@/features/pricing/api';
import { ImportError } from '@/features/recipes/import';

/**
 * "Estimate N with AI" for ingredients with no price at all (ADR 0022). Premium:
 * one credit per tap, never spent automatically. Free users see what premium
 * would do instead. Renders nothing when there's nothing to estimate.
 */
export function AiEstimateButton({ canonicalIds }: { canonicalIds: string[] }) {
  const { householdId } = useHousehold();
  const { isPremium, isLoading } = useEntitlement();
  const qc = useQueryClient();
  const estimate = useMutation<number, Error, string[]>({
    mutationFn: (ids) => requestAiEstimates(householdId as string, ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pricingKeys.householdEstimates(householdId ?? 'none') });
      for (const prefix of pricingKeys.spendAffected()) void qc.invalidateQueries({ queryKey: prefix });
    },
  });

  const n = canonicalIds.length;
  if (n === 0 || isLoading) return null;
  const what = `${n} missing price${n === 1 ? '' : 's'}`;

  if (!isPremium) {
    return (
      <span className="text-muted-foreground text-xs" data-testid="ai-estimate">
        Premium can estimate the {what} with AI.
      </span>
    );
  }

  return (
    <span className="text-xs" data-testid="ai-estimate">
      <button
        type="button"
        className="text-primary underline disabled:opacity-60"
        disabled={estimate.isPending}
        onClick={() => estimate.mutate(canonicalIds)}
      >
        {estimate.isPending ? <Loading>Estimating</Loading> : `Estimate ${what} with AI`}
      </button>
      {estimate.isError && (
        <span className="text-destructive">
          {' '}
          {estimate.error instanceof ImportError && estimate.error.limitReached
            ? 'You’ve used this month’s AI estimates.'
            : estimate.error.message}
        </span>
      )}
      {estimate.isSuccess && estimate.data === 0 && (
        <span className="text-muted-foreground"> Couldn’t estimate those — try adding a price.</span>
      )}
    </span>
  );
}
