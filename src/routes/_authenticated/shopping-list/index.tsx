import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CanonicalCombobox } from '@/features/ingredients/components/canonical-combobox';
import { useApplyPurchaseToPantry } from '@/features/pantry/use-pantry';
import { fromISO, weekRange } from '@/features/planner/dates';
import { ScanButton } from '@/features/scanner/scan-button';
import type { ShoppingListSummary } from '@/features/shopping-list/api';
import {
  useAddToRunningList,
  useGenerateTripList,
  useItemEdits,
  useShoppingList,
  useShoppingLists,
  useToggleItem,
} from '@/features/shopping-list/use-shopping-list';
import { cn } from '@/lib/utils/cn';

export const Route = createFileRoute('/_authenticated/shopping-list/')({
  component: ShoppingListsPage,
});

function trim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function ShoppingListsPage() {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const { data: lists } = useShoppingLists();

  const running = lists?.find((l) => l.isRunning);
  const weeklyLists = (lists ?? []).filter((l) => !l.isRunning);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Shopping list</h1>
        <Button onClick={() => setGenerating(true)}>Generate a list</Button>
      </div>

      <OngoingList running={running} />

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Generated lists
        </h2>
        {weeklyLists.map((l) => (
          <Link key={l.id} to="/shopping-list/$listId" params={{ listId: l.id }} className="block">
            <Card className="hover:border-primary/50 transition-colors">
              <CardContent className="flex items-center justify-between p-4">
                <span className="font-medium">{l.name}</span>
                <span className="text-muted-foreground text-xs">
                  {l.dateRangeStart} → {l.dateRangeEnd}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
        {weeklyLists.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No generated lists yet. Plan some meals, then generate a list for that week.
          </p>
        )}
      </section>

      {generating && (
        <GenerateModal
          onClose={() => setGenerating(false)}
          onDone={(id) => {
            setGenerating(false);
            void navigate({ to: '/shopping-list/$listId', params: { listId: id } });
          }}
        />
      )}
    </main>
  );
}

/**
 * The household's standing list, shown inline so you see what you need without
 * clicking through. Jot anything, anytime — no plan required. Typed items are
 * matched to a real ingredient (aisle, price, pantry link) by the smart add, and
 * the list is created on the first item.
 */
function OngoingList({ running }: { running?: ShoppingListSummary }) {
  const runningId = running?.id ?? '';
  const add = useAddToRunningList();
  const { data } = useShoppingList(runningId);
  const toggle = useToggleItem(runningId);
  const edits = useItemEdits(runningId);
  const applyToPantry = useApplyPurchaseToPantry();

  const [picked, setPicked] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [typed, setTyped] = useState('');
  const [seed, setSeed] = useState('');
  const [comboKey, setComboKey] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const items = data?.items ?? [];

  function onScanned(name: string) {
    setSeed(name);
    setTyped(name);
    setPicked({ id: null, name: null });
    setComboKey((k) => k + 1);
    setFeedback(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = (typed.trim() || picked.name?.trim()) ?? '';
    if (name === '') {
      setFeedback({ type: 'error', message: 'Type something you need (e.g. “dish soap”).' });
      return;
    }
    try {
      const { result } = await add.mutateAsync({ name, quantity: null, unit: null });
      setFeedback({
        type: 'success',
        message: result === 'exists' ? `${name} is already on your list.` : `Added ${name}.`,
      });
      setPicked({ id: null, name: null });
      setTyped('');
      setSeed('');
      setComboKey((k) => k + 1);
    } catch {
      setFeedback({ type: 'error', message: 'Couldn’t add that — please try again.' });
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">Things you need</h2>
        <p className="text-muted-foreground text-sm">
          Jot down anything you’re out of — it’s always here, no meal plan needed.
        </p>
      </div>

      <form onSubmit={submit} className="flex items-start gap-2">
        <div className="flex-1">
          <CanonicalCombobox
            key={comboKey}
            value={picked}
            seedName={seed || undefined}
            onSelect={(id, name) => {
              setPicked({ id, name });
              setTyped(name ?? '');
              setFeedback(null);
            }}
            onTextChange={(t) => {
              setTyped(t);
              setFeedback(null);
            }}
            placeholder="Add something you need…"
          />
        </div>
        <ScanButton size="default" onResult={onScanned} />
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? 'Adding…' : 'Add'}
        </Button>
      </form>
      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className={feedback.type === 'success' ? 'text-sm text-emerald-700' : 'text-destructive text-sm'}
        >
          {feedback.message}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing here yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((item) => {
            const quantityText =
              item.totalQuantity != null ? `${trim(item.totalQuantity)} ${item.unit ?? ''}`.trim() : null;
            return (
              <li key={item.id} className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  checked={item.isChecked}
                  onChange={(e) => {
                    toggle.mutate({ itemId: item.id, checked: e.target.checked });
                    applyToPantry.mutate({ item, checked: e.target.checked });
                  }}
                  aria-label={`Check off ${item.displayName}`}
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm',
                    item.isChecked && 'text-muted-foreground line-through',
                  )}
                >
                  {item.displayName}
                  {quantityText && (
                    <span className="text-muted-foreground"> · {quantityText}</span>
                  )}
                </span>
                <button
                  type="button"
                  className="text-destructive shrink-0 text-xs underline"
                  onClick={() => edits.removeItem.mutate(item.id)}
                >
                  remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Modal for generating a shopping trip over a date range. Pulls together the
 * meal plan for those dates, the running list, and low-stock pantry items.
 */
function GenerateModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (listId: string) => void;
}) {
  const week = weekRange(new Date());
  const [start, setStart] = useState(week.start);
  const [end, setEnd] = useState(week.end);
  const [name, setName] = useState(`Week of ${format(fromISO(week.start), 'MMM d')}`);
  const [subtractPantry, setSubtractPantry] = useState(true);
  const generate = useGenerateTripList();

  async function onGenerate() {
    const id = await generate.mutateAsync({ name, start, end, subtractPantry });
    onDone(id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="bg-background w-full max-w-md rounded-lg border shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">Generate a list</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-muted-foreground text-sm">
            Pulls in your meal plan for these dates and whatever’s on your ongoing list. Pantry
            items running low are suggested on the list so you can add what you want.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">From</Label>
              <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">To</Label>
              <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">List name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={subtractPantry}
              onChange={(e) => setSubtractPantry(e.target.checked)}
            />
            Subtract what’s already in my pantry
          </label>
          {generate.isError && (
            <p className="text-destructive text-sm">Couldn’t generate. Try again.</p>
          )}
          <Button onClick={onGenerate} disabled={generate.isPending} className="w-full">
            {generate.isPending ? 'Generating…' : 'Generate list'}
          </Button>
        </div>
      </div>
    </div>
  );
}
