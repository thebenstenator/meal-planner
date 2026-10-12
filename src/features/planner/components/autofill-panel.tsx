import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { useEntitlement } from '@/features/billing/use-entitlement';
import { useHousehold } from '@/features/household/use-household';
import { mealCostModel, type MealCost, type NoveltyLevel } from '@/features/planner/autofill';
import { fromISO } from '@/features/planner/dates';
import {
  useCommitProposal,
  useGenerateProposal,
  type Proposal,
  type ProposalRow,
} from '@/features/planner/use-autofill';
import { keyOf } from '@/features/planner/view';
import { useRecipeCosts } from '@/features/pricing/use-planner-cost';
import { centsToDollars, dollarsToCents } from '@/features/receipts/money';
import { listLibraryForAutofill } from '@/features/recipes/api';
import { ImportError } from '@/features/recipes/import';
import { formatCurrency } from '@/lib/utils/format-currency';
import type { Slot } from '@/schemas/plan';

const NOVELTY: { value: NoveltyLevel; label: string; hint: string }[] = [
  { value: 'all-favorites', label: 'All favorites', hint: 'Only recipes you already have' },
  { value: 'few-new', label: 'A few new', hint: '~1 fresh idea per week' },
  { value: 'many-new', label: 'Lots new', hint: '~2–3 fresh ideas per week' },
];

const ALL_SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner'];

type CostOf = (recipeId: string | undefined, slot: Slot) => MealCost;

interface Props {
  monthLabel: string;
  /** Days (ISO) still ahead in the month — the ones auto-fill may fill. */
  days: string[];
  /** keyOf(date, slot) cells that already have a plan entry — never overwritten. */
  occupied: Set<string>;
  /** The household's monthly goal, if set. */
  budgetCents: number | null;
  /** What's left of it after the month's forecast — the default room for new meals. */
  roomCents: number | null;
  onClose: () => void;
  onDone: () => void;
}

export function AutofillPanel({
  monthLabel,
  days,
  occupied,
  budgetCents,
  roomCents,
  onClose,
  onDone,
}: Props) {
  const { householdId } = useHousehold();
  const { isPremium, isLoading } = useEntitlement();
  const generate = useGenerateProposal();
  const commit = useCommitProposal();

  // The library's per-meal costs, so the budget can steer the plan and the
  // review can show what each meal costs.
  const { data: library } = useQuery({
    queryKey: ['autofill-library', householdId ?? 'none'],
    queryFn: () => listLibraryForAutofill(householdId as string),
    enabled: !!householdId,
  });
  const libraryIds = useMemo(() => (library ?? []).map((r) => r.id), [library]);
  const { costById, isLoading: costsLoading } = useRecipeCosts(libraryIds);
  const costOf = useMemo(
    () => mealCostModel(library ?? [], costById),
    [library, costById],
  );

  const [novelty, setNovelty] = useState<NoveltyLevel>('few-new');
  const [dinnerOnly, setDinnerOnly] = useState(true);
  const [useBudget, setUseBudget] = useState(budgetCents != null);
  // Follows the forecast's room (it may still be loading on open) until typed in.
  const [typedTarget, setTypedTarget] = useState<string | null>(null);
  const target =
    typedTarget ?? (roomCents == null ? '' : centsToDollars(Math.max(0, roomCents)));
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [error, setError] = useState<{ message: string; limitReached: boolean } | null>(null);

  const targetCents = dollarsToCents(target);
  const targetInvalid = useBudget && (targetCents == null || targetCents < 0);
  const budgetOn = useBudget && costOf != null && !targetInvalid;

  async function onGenerate() {
    setError(null);
    const slots = dinnerOnly ? (['dinner'] as Slot[]) : ALL_SLOTS;
    try {
      const result = await generate.mutateAsync({
        days,
        slots,
        novelty,
        occupied,
        budget: budgetOn ? { cents: targetCents as number, costById } : undefined,
      });
      setProposal(result);
      setRows(result.rows);
      setSkipped(new Set());
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Could not build a plan',
        limitReached: err instanceof ImportError && err.limitReached,
      });
    }
  }

  async function onCommit() {
    const toSave = rows.filter((r) => !skipped.has(keyOf(r.date, r.slot)));
    if (toSave.length === 0) return;
    await commit.mutateAsync(toSave);
    onDone();
  }

  function reassign(row: ProposalRow, value: string) {
    const k = keyOf(row.date, row.slot);
    if (value === 'skip') {
      setSkipped((prev) => new Set(prev).add(k));
      return;
    }
    setSkipped((prev) => {
      const next = new Set(prev);
      next.delete(k);
      return next;
    });
    if (value === 'ai') return; // keep the row as-is (its AI idea)
    const lib = proposal?.library.find((r) => r.id === value.replace('lib:', ''));
    if (!lib) return;
    setRows((prev) =>
      prev.map((r) =>
        keyOf(r.date, r.slot) === k
          ? { ...r, source: 'library', recipeId: lib.id, title: lib.title, idea: undefined }
          : r,
      ),
    );
  }

  const byDate = useMemo(() => {
    const map = new Map<string, ProposalRow[]>();
    for (const r of rows) {
      const b = map.get(r.date);
      if (b) b.push(r);
      else map.set(r.date, [r]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const kept = rows.filter((r) => !skipped.has(keyOf(r.date, r.slot)));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="bg-background w-full max-w-2xl rounded-lg border shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">Auto-fill {monthLabel}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {!isLoading && !isPremium ? (
            <Paywall />
          ) : proposal === null ? (
            <ConfigStep
              novelty={novelty}
              setNovelty={setNovelty}
              dinnerOnly={dinnerOnly}
              setDinnerOnly={setDinnerOnly}
              budget={{
                on: useBudget,
                setOn: setUseBudget,
                target,
                setTarget: setTypedTarget,
                invalid: targetInvalid && costOf != null,
                canPrice: costOf != null,
                pricing: costsLoading,
                budgetCents,
                roomCents,
                monthLabel,
              }}
              onGenerate={onGenerate}
              generating={generate.isPending}
              error={error}
            />
          ) : (
            <ReviewStep
              byDate={byDate}
              proposal={proposal}
              skipped={skipped}
              kept={kept}
              costOf={costOf}
              costById={costById}
              reassign={reassign}
              onRegenerate={() => {
                setProposal(null);
                setRows([]);
              }}
              onCommit={onCommit}
              committing={commit.isPending}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface BudgetControl {
  on: boolean;
  setOn: (v: boolean) => void;
  target: string;
  setTarget: (v: string) => void;
  invalid: boolean;
  /** False when nothing in the library is priced — no basis for a budget. */
  canPrice: boolean;
  pricing: boolean;
  budgetCents: number | null;
  roomCents: number | null;
  monthLabel: string;
}

function ConfigStep({
  novelty,
  setNovelty,
  dinnerOnly,
  setDinnerOnly,
  budget,
  onGenerate,
  generating,
  error,
}: {
  novelty: NoveltyLevel;
  setNovelty: (n: NoveltyLevel) => void;
  dinnerOnly: boolean;
  setDinnerOnly: (v: boolean) => void;
  budget: BudgetControl;
  onGenerate: () => void;
  generating: boolean;
  error: { message: string; limitReached: boolean } | null;
}) {
  return (
    <>
      <p className="text-muted-foreground text-sm">
        We’ll fill the rest of this month’s empty slots — leaning on your favorites and the
        recipes you haven’t cooked in a while, with as much variety as you like. Nothing is saved
        until you review it.
      </p>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">How much novelty?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {NOVELTY.map((n) => (
            <button
              key={n.value}
              type="button"
              onClick={() => setNovelty(n.value)}
              className={`rounded-lg border p-3 text-left ${
                novelty === n.value ? 'border-primary ring-primary/30 ring-2' : ''
              }`}
            >
              <div className="text-sm font-medium">{n.label}</div>
              <div className="text-muted-foreground text-xs">{n.hint}</div>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Which meals?</legend>
        <div className="flex gap-2">
          {[
            { v: true, label: 'Dinner only' },
            { v: false, label: 'All meals' },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => setDinnerOnly(o.v)}
              className={`rounded-full border px-3 py-1 text-sm ${
                dinnerOnly === o.v ? 'bg-primary text-primary-foreground border-primary' : ''
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <BudgetFieldset budget={budget} />

      {error && (
        <p className="text-destructive text-sm">
          {error.limitReached ? 'You’ve hit this month’s limit — try “All favorites”.' : error.message}
        </p>
      )}

      <Button onClick={onGenerate} disabled={generating || budget.invalid}>
        {generating ? <Loading>Building your month</Loading> : 'Build a plan'}
      </Button>
    </>
  );
}

/** "Keep new meals under $___", defaulting to what's left of the month's budget. */
function BudgetFieldset({ budget }: { budget: BudgetControl }) {
  if (budget.pricing) {
    return (
      <p className="text-muted-foreground text-sm">
        <Loading>Pricing your recipes</Loading>
      </p>
    );
  }
  if (!budget.canPrice) {
    return (
      <p className="text-muted-foreground text-sm">
        Price a few ingredients at your store and auto-fill can plan to a budget, too.
      </p>
    );
  }

  let hint: string;
  if (budget.budgetCents == null) {
    hint = 'No monthly budget set — enter a limit for these meals, or leave it off.';
  } else if (budget.roomCents != null && budget.roomCents <= 0) {
    hint = `Your ${budget.monthLabel} budget is already taken by what’s spent and planned, so this plan leans on your cheapest meals.`;
  } else {
    hint = `What’s left of your ${formatCurrency(budget.budgetCents)} ${budget.monthLabel} budget after what’s spent and already planned.`;
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">Budget</legend>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={budget.on}
          onChange={(e) => budget.setOn(e.target.checked)}
          className="size-4"
        />
        Keep new meals under
      </label>
      {budget.on && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">$</span>
            <Input
              aria-label="Budget for new meals"
              inputMode="decimal"
              className="w-32"
              placeholder="e.g. 250"
              value={budget.target}
              aria-invalid={budget.invalid}
              onChange={(e) => budget.setTarget(e.target.value)}
            />
          </div>
          {budget.invalid ? (
            <p className="text-destructive text-xs">Enter an amount like 250 or 249.50.</p>
          ) : (
            <p className="text-muted-foreground text-xs">{hint}</p>
          )}
        </>
      )}
    </fieldset>
  );
}

function ReviewStep({
  byDate,
  proposal,
  skipped,
  kept,
  costOf,
  costById,
  reassign,
  onRegenerate,
  onCommit,
  committing,
}: {
  byDate: [string, ProposalRow[]][];
  proposal: Proposal;
  skipped: Set<string>;
  kept: ProposalRow[];
  costOf: CostOf | null;
  costById: Map<string, number | null>;
  reassign: (row: ProposalRow, value: string) => void;
  onRegenerate: () => void;
  onCommit: () => void;
  committing: boolean;
}) {
  if (byDate.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Every slot left this month is already planned — nothing to fill.
        </p>
        <Button variant="outline" onClick={onRegenerate}>
          Back
        </Button>
      </div>
    );
  }

  const keepCount = kept.length;
  const rowCost = (r: ProposalRow) =>
    costOf ? costOf(r.source === 'library' ? r.recipeId : undefined, r.slot) : null;
  const costs = kept.map(rowCost);
  const totalCents = costs.reduce((s, c) => s + (c?.cents ?? 0), 0);
  const anyEstimated = costs.some((c) => c?.estimated);
  const fit = proposal.fit;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm">
          {keepCount} meal{keepCount === 1 ? '' : 's'} to add
          {proposal.aiCount > 0
            ? ` · ${proposal.aiCount} fresh idea${proposal.aiCount === 1 ? '' : 's'}`
            : ''}
          . Swap or skip any of them.
        </p>
        {costOf && (
          <p className="text-sm" data-testid="autofill-total">
            <span className="font-medium">
              {anyEstimated ? '~' : ''}
              {formatCurrency(totalCents)}
            </span>{' '}
            <span className="text-muted-foreground">for these meals</span>
            {fit && (
              <span
                className={totalCents > fit.targetCents ? 'text-destructive' : 'text-emerald-600'}
              >
                {' · '}
                {totalCents > fit.targetCents
                  ? `${formatCurrency(totalCents - fit.targetCents)} over your ${formatCurrency(fit.targetCents)}`
                  : `within your ${formatCurrency(fit.targetCents)}`}
              </span>
            )}
          </p>
        )}
        {fit && fit.swaps > 0 && (
          <p className="text-muted-foreground text-xs">
            Swapped {fit.swaps} pricier meal{fit.swaps === 1 ? '' : 's'} for cheaper ones to fit.
          </p>
        )}
        {fit && !fit.withinBudget && (
          <p className="text-muted-foreground text-xs">
            Even the cheapest picks run over — skip a few meals, or raise the limit.
          </p>
        )}
        {anyEstimated && (
          <p className="text-muted-foreground text-xs">
            ~ includes new ideas and unpriced recipes at a typical meal’s cost.
          </p>
        )}
      </div>

      <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
        {byDate.map(([date, dayRows]) => (
          <div key={date}>
            <div className="text-muted-foreground mb-1 text-xs font-medium">
              {format(fromISO(date), 'EEE, MMM d')}
            </div>
            <ul className="space-y-1.5">
              {dayRows.map((row) => {
                const k = keyOf(row.date, row.slot);
                const isSkipped = skipped.has(k);
                const c = rowCost(row);
                return (
                  <li
                    key={k}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      isSkipped ? 'opacity-40' : ''
                    }`}
                  >
                    <span className="text-muted-foreground w-16 shrink-0 text-xs capitalize">
                      {row.slot}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{row.title}</span>
                    {row.source === 'ai' && !isSkipped && (
                      <Badge variant="outline" className="shrink-0 text-emerald-700">
                        new
                      </Badge>
                    )}
                    {/* The swap menu already shows a priced recipe's cost; only an
                        estimate (new idea, unpriced recipe) needs its own label. */}
                    {c?.estimated && !isSkipped && (
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        ~{formatCurrency(c.cents)}
                      </span>
                    )}
                    <select
                      aria-label={`Change ${row.slot} on ${date}`}
                      className="bg-background max-w-[9rem] shrink-0 rounded border px-1 py-1 text-xs"
                      value={isSkipped ? 'skip' : row.source === 'ai' ? 'ai' : `lib:${row.recipeId}`}
                      onChange={(e) => reassign(row, e.target.value)}
                    >
                      {row.source === 'ai' && <option value="ai">{row.title} (new)</option>}
                      <optgroup label="Your recipes">
                        {proposal.library.map((r) => {
                          const rc = costById.get(r.id);
                          return (
                            <option key={r.id} value={`lib:${r.id}`}>
                              {r.title}
                              {rc != null ? ` · ${formatCurrency(rc)}` : ''}
                            </option>
                          );
                        })}
                      </optgroup>
                      <option value="skip">— skip —</option>
                    </select>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t pt-3">
        <Button onClick={onCommit} disabled={committing || keepCount === 0}>
          {committing ? <Loading>Adding to plan</Loading> : `Fill ${keepCount} meal${keepCount === 1 ? '' : 's'}`}
        </Button>
        <Button variant="ghost" onClick={onRegenerate} disabled={committing}>
          Start over
        </Button>
      </div>
    </div>
  );
}

function Paywall() {
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="font-medium">Auto-fill is a premium feature</p>
      <p className="text-muted-foreground text-sm">
        Auto-filling a balanced month — favorites, fresh ideas, and variety in one tap — is a
        premium feature.
      </p>
    </div>
  );
}
