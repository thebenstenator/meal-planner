import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CanonicalCombobox } from '@/features/ingredients/components/canonical-combobox';
import type { PantryItem, PantryLocation } from '@/features/pantry/api';
import { PantryBulkImport } from '@/features/pantry/components/bulk-import';
import { usePantry, usePantryMutations } from '@/features/pantry/use-pantry';
import { useHousehold } from '@/features/household/use-household';

export const Route = createFileRoute('/_authenticated/pantry')({
  component: PantryPage,
});

const LOCATIONS: PantryLocation[] = ['pantry', 'fridge', 'freezer'];

function PantryPage() {
  const { householdId } = useHousehold();
  const { data, isLoading, isError } = usePantry();
  const { add } = usePantryMutations();

  const [picked, setPicked] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [location, setLocation] = useState<PantryLocation>('pantry');

  const items = data ?? [];
  const byLocation = new Map<PantryLocation, PantryItem[]>();
  for (const loc of LOCATIONS) byLocation.set(loc, []);
  for (const item of items) byLocation.get(item.location)?.push(item);

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!picked.id) return;
    add.mutate(
      {
        canonicalId: picked.id,
        quantity: qty.trim() === '' ? 0 : Number(qty),
        unit: unit.trim() || null,
        location,
      },
      {
        onSuccess: () => {
          setPicked({ id: null, name: null });
          setQty('');
          setUnit('');
        },
      },
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Pantry</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          What you have on hand. Set it up once — later it updates as you shop and cook.
        </p>
      </div>

      <form onSubmit={submitAdd} className="space-y-2 rounded-lg border p-3">
        <span className="text-sm font-medium">Add an item</span>
        <CanonicalCombobox
          value={picked}
          onSelect={(id, name) => setPicked({ id, name })}
          placeholder="Search ingredient…"
        />
        <div className="flex gap-2">
          <Input
            aria-label="Quantity"
            inputMode="decimal"
            placeholder="qty"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-20"
          />
          <Input
            aria-label="Unit"
            placeholder="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-24"
          />
          <select
            aria-label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value as PantryLocation)}
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm capitalize"
          >
            {LOCATIONS.map((l) => (
              <option key={l} value={l} className="capitalize">
                {l}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={!picked.id || add.isPending}>
            Add
          </Button>
        </div>
      </form>

      {householdId && <PantryBulkImport householdId={householdId} />}

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn’t load your pantry.</p>}

      {data && items.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">Your pantry is empty</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add what you’ve got above. Bought items and cooked meals will keep it current.
          </p>
        </div>
      )}

      {LOCATIONS.map((loc) => {
        const locItems = byLocation.get(loc) ?? [];
        if (locItems.length === 0) return null;
        return (
          <section key={loc}>
            <h2 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
              {loc}
            </h2>
            <ul className="divide-y rounded-lg border">
              {locItems.map((item) => (
                <PantryRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}

function PantryRow({ item }: { item: PantryItem }) {
  const { update, remove } = usePantryMutations();
  const [qty, setQty] = useState(String(item.quantity));

  function commitQty() {
    const n = Number(qty);
    if (Number.isFinite(n) && n >= 0 && n !== item.quantity) {
      update.mutate({ id: item.id, quantity: n });
    }
  }

  return (
    <li className="flex items-center justify-between gap-2 p-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.canonicalName}</span>
      <div className="flex items-center gap-1">
        <Input
          aria-label={`Quantity of ${item.canonicalName}`}
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={commitQty}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitQty();
            }
          }}
          className="h-8 w-16"
        />
        <span className="text-muted-foreground w-10 text-xs">{item.unit ?? ''}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => remove.mutate(item.id)}
          aria-label={`Remove ${item.canonicalName}`}
        >
          ✕
        </Button>
      </div>
    </li>
  );
}
