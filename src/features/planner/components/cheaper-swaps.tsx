import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useEntitlement } from '@/features/billing/use-entitlement';
import { useHousehold } from '@/features/household/use-household';
import type { PlanEntry } from '@/features/planner/api';
import { suggestSwaps } from '@/features/planner/swaps';
import { useSwapEntryRecipe } from '@/features/planner/use-planner';
import { EstMark } from '@/features/pricing/components/recipe-cost-tag';
import { useRecipeCosts } from '@/features/pricing/use-planner-cost';
import { listLibraryForAutofill } from '@/features/recipes/api';
import { formatCurrency } from '@/lib/utils/format-currency';

/**
 * Cheaper swaps for the meals in view (ADR 0020): "Tue · Salmon → Chicken ·
 * save $9" with a one-tap Swap. Premium — it thinks for you — but free users
 * see what it would save, so the value is visible. Renders nothing when there's
 * nothing worth swapping.
 */
export function CheaperSwaps({
  entries,
  label,
}: {
  entries: PlanEntry[];
  label: string;
}) {
  const { householdId } = useHousehold();
  const { isPremium } = useEntitlement();
  const swap = useSwapEntryRecipe();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Same query auto-fill uses — the library with its liked/cooked signals.
  const { data: library } = useQuery({
    queryKey: ['autofill-library', householdId ?? 'none'],
    queryFn: () => listLibraryForAutofill(householdId as string),
    enabled: !!householdId,
  });
  const ids = useMemo(() => (library ?? []).map((r) => r.id), [library]);
  const { detailById, isLoading } = useRecipeCosts(ids);

  const suggestions = useMemo(
    () =>
      suggestSwaps(
        entries,
        library ?? [],
        (id) => detailById.get(id),
        format(new Date(), 'yyyy-MM-dd'),
      ).filter((s) => !dismissed.has(s.entryId)),
    [entries, library, detailById, dismissed],
  );

  if (isLoading || suggestions.length === 0) return null;
  const total = suggestions.reduce((s, x) => s + x.savingsCents, 0);

  if (!isPremium) {
    return (
      <p className="text-muted-foreground text-sm" data-testid="cheaper-swaps">
        Cheaper swaps could save about {formatCurrency(total)} {label} — a premium
        feature.
      </p>
    );
  }

  return (
    <section className="space-y-2 rounded-lg border p-3" data-testid="cheaper-swaps">
      <h2 className="text-sm font-medium">
        Cheaper swaps · save {formatCurrency(total)} {label}
      </h2>
      <ul className="space-y-1.5">
        {suggestions.map((s) => (
          <li
            key={s.entryId}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
          >
            <span className="text-muted-foreground w-10 shrink-0 text-xs">
              {format(parseISO(s.date), 'EEE')}
            </span>
            {/* Names wrap rather than truncate — the swap target is the point —
                and the controls drop to their own line when they need to. */}
            <span className="min-w-0 grow basis-40">
              <span className="text-muted-foreground">{s.fromTitle} → </span>
              {s.toTitle}
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-2">
              <span className="shrink-0 text-xs text-emerald-600 tabular-nums">
                {s.estimated && <EstMark />}save {formatCurrency(s.savingsCents)}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0"
                disabled={swap.isPending}
                onClick={() => swap.mutate({ id: s.entryId, recipeId: s.toRecipeId })}
                aria-label={`Swap ${s.fromTitle} for ${s.toTitle}`}
              >
                Swap
              </Button>
              <button
                type="button"
                className="text-muted-foreground shrink-0 px-1 text-xs"
                onClick={() => setDismissed((prev) => new Set(prev).add(s.entryId))}
                aria-label={`Keep ${s.fromTitle}`}
                title="Keep this meal"
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
