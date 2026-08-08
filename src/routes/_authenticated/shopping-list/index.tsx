import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CanonicalCombobox } from '@/features/ingredients/components/canonical-combobox';
import { fromISO, weekRange } from '@/features/planner/dates';
import { ScanButton } from '@/features/scanner/scan-button';
import type { ShoppingListSummary } from '@/features/shopping-list/api';
import {
  useAddToRunningList,
  useGenerateList,
  useShoppingLists,
} from '@/features/shopping-list/use-shopping-list';

export const Route = createFileRoute('/_authenticated/shopping-list/')({
  component: ShoppingListsPage,
});

function ShoppingListsPage() {
  const navigate = useNavigate();
  const week = weekRange(new Date());
  const [start, setStart] = useState(week.start);
  const [end, setEnd] = useState(week.end);
  const [name, setName] = useState(`Week of ${format(fromISO(week.start), 'MMM d')}`);
  const [subtractPantry, setSubtractPantry] = useState(true);
  const generate = useGenerateList();
  const { data: lists } = useShoppingLists();

  const running = lists?.find((l) => l.isRunning);
  const weeklyLists = (lists ?? []).filter((l) => !l.isRunning);

  async function onGenerate() {
    const id = await generate.mutateAsync({ name, start, end, subtractPantry });
    await navigate({ to: '/shopping-list/$listId', params: { listId: id } });
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Shopping lists</h1>

      <RunningListCard running={running} />

      <Card>
        <CardHeader>
          <CardTitle>Generate a list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
          <Button onClick={onGenerate} disabled={generate.isPending}>
            {generate.isPending ? 'Generating…' : 'Generate consolidated list'}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
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
            No weekly lists yet. Plan some meals, then generate a list for that week.
          </p>
        )}
      </div>
    </main>
  );
}

/**
 * The household's standing list: jot anything you need, anytime — no plan
 * required. Typed items are matched to a real ingredient (aisle, price, pantry
 * link) by the smart add. The list is created on the first item.
 */
function RunningListCard({ running }: { running?: ShoppingListSummary }) {
  const add = useAddToRunningList();
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Things you need</CardTitle>
        {running && (
          <Button asChild variant="ghost" size="sm">
            <Link to="/shopping-list/$listId" params={{ listId: running.id }}>
              Open list
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Jot down anything you’re out of — it’s always here, no meal plan needed.
        </p>
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
      </CardContent>
    </Card>
  );
}
