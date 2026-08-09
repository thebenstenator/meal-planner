import { format } from 'date-fns';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEntitlement } from '@/features/billing/use-entitlement';
import type { NoveltyLevel } from '@/features/planner/autofill';
import { fromISO } from '@/features/planner/dates';
import {
  useCommitProposal,
  useGenerateProposal,
  type Proposal,
  type ProposalRow,
} from '@/features/planner/use-autofill';
import { keyOf } from '@/features/planner/view';
import { ImportError } from '@/features/recipes/import';
import type { Slot } from '@/schemas/plan';

const NOVELTY: { value: NoveltyLevel; label: string; hint: string }[] = [
  { value: 'all-favorites', label: 'All favorites', hint: 'Only recipes you already have' },
  { value: 'few-new', label: 'A few new', hint: '~1 fresh idea per week' },
  { value: 'many-new', label: 'Lots new', hint: '~2–3 fresh ideas per week' },
];

const ALL_SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner'];

interface Props {
  monthLabel: string;
  /** Calendar-month days (ISO) to fill. */
  days: string[];
  /** keyOf(date, slot) cells that already have a plan entry — never overwritten. */
  occupied: Set<string>;
  onClose: () => void;
  onDone: () => void;
}

export function AutofillPanel({ monthLabel, days, occupied, onClose, onDone }: Props) {
  const { isPremium, isLoading } = useEntitlement();
  const generate = useGenerateProposal();
  const commit = useCommitProposal();

  const [novelty, setNovelty] = useState<NoveltyLevel>('few-new');
  const [dinnerOnly, setDinnerOnly] = useState(true);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [error, setError] = useState<{ message: string; limitReached: boolean } | null>(null);

  async function onGenerate() {
    setError(null);
    const slots = dinnerOnly ? (['dinner'] as Slot[]) : ALL_SLOTS;
    try {
      const result = await generate.mutateAsync({ days, slots, novelty });
      // Only ever fill gaps — drop any cell that's already planned.
      const gaps = result.rows.filter((r) => !occupied.has(keyOf(r.date, r.slot)));
      setProposal(result);
      setRows(gaps);
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

  const keepCount = rows.filter((r) => !skipped.has(keyOf(r.date, r.slot))).length;

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
              onGenerate={onGenerate}
              generating={generate.isPending}
              error={error}
            />
          ) : (
            <ReviewStep
              byDate={byDate}
              proposal={proposal}
              skipped={skipped}
              keepCount={keepCount}
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

function ConfigStep({
  novelty,
  setNovelty,
  dinnerOnly,
  setDinnerOnly,
  onGenerate,
  generating,
  error,
}: {
  novelty: NoveltyLevel;
  setNovelty: (n: NoveltyLevel) => void;
  dinnerOnly: boolean;
  setDinnerOnly: (v: boolean) => void;
  onGenerate: () => void;
  generating: boolean;
  error: { message: string; limitReached: boolean } | null;
}) {
  return (
    <>
      <p className="text-muted-foreground text-sm">
        We’ll fill this month’s empty slots — leaning on your favorites and the recipes you
        haven’t cooked in a while, with as much variety as you like. Nothing is saved until you
        review it.
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

      {error && (
        <p className="text-destructive text-sm">
          {error.limitReached ? 'You’ve hit this month’s limit — try “All favorites”.' : error.message}
        </p>
      )}

      <Button onClick={onGenerate} disabled={generating}>
        {generating ? 'Building your month…' : 'Build a plan'}
      </Button>
    </>
  );
}

function ReviewStep({
  byDate,
  proposal,
  skipped,
  keepCount,
  reassign,
  onRegenerate,
  onCommit,
  committing,
}: {
  byDate: [string, ProposalRow[]][];
  proposal: Proposal;
  skipped: Set<string>;
  keepCount: number;
  reassign: (row: ProposalRow, value: string) => void;
  onRegenerate: () => void;
  onCommit: () => void;
  committing: boolean;
}) {
  if (byDate.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Every slot this month is already planned — nothing to fill.
        </p>
        <Button variant="outline" onClick={onRegenerate}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {keepCount} meal{keepCount === 1 ? '' : 's'} to add
        {proposal.aiCount > 0 ? ` · ${proposal.aiCount} fresh idea${proposal.aiCount === 1 ? '' : 's'}` : ''}. Swap
        or skip any of them.
      </p>

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
                    <select
                      aria-label={`Change ${row.slot} on ${date}`}
                      className="bg-background max-w-[9rem] shrink-0 rounded border px-1 py-1 text-xs"
                      value={isSkipped ? 'skip' : row.source === 'ai' ? 'ai' : `lib:${row.recipeId}`}
                      onChange={(e) => reassign(row, e.target.value)}
                    >
                      {row.source === 'ai' && <option value="ai">{row.title} (new)</option>}
                      <optgroup label="Your recipes">
                        {proposal.library.map((r) => (
                          <option key={r.id} value={`lib:${r.id}`}>
                            {r.title}
                          </option>
                        ))}
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
          {committing ? 'Adding to plan…' : `Fill ${keepCount} meal${keepCount === 1 ? '' : 's'}`}
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
