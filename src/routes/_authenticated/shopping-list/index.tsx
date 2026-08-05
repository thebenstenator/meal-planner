import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fromISO, weekRange } from '@/features/planner/dates';
import { useGenerateList, useShoppingLists } from '@/features/shopping-list/use-shopping-list';

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

  async function onGenerate() {
    const id = await generate.mutateAsync({ name, start, end, subtractPantry });
    await navigate({ to: '/shopping-list/$listId', params: { listId: id } });
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Shopping lists</h1>

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
        {(lists ?? []).map((l) => (
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
        {lists && lists.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No lists yet. Plan some meals, then generate a list for that week.
          </p>
        )}
      </div>
    </main>
  );
}
