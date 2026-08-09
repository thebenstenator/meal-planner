import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { AddMenu } from '@/components/add-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CanonicalCombobox } from '@/features/ingredients/components/canonical-combobox';
import { resolveOrCreateCanonical } from '@/features/ingredients/resolve';
import { ScanButton } from '@/features/scanner/scan-button';
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
  const [typed, setTyped] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [location, setLocation] = useState<PantryLocation>('pantry');
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  // Seed text (e.g. from a barcode scan) to preload the combobox with.
  const [seed, setSeed] = useState('');
  // Bumped after each add / scan to remount the combobox (its text is internal).
  const [formKey, setFormKey] = useState(0);

  function onScanned(name: string) {
    setSeed(name);
    setTyped(name);
    setPicked({ id: null, name: null });
    setFormKey((k) => k + 1);
    setFeedback(null);
  }

  const items = data ?? [];
  const byLocation = new Map<PantryLocation, PantryItem[]>();
  for (const loc of LOCATIONS) byLocation.set(loc, []);
  for (const item of items) byLocation.get(item.location)?.push(item);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    const text = typed.trim();
    // Nothing to go on — no pick and an empty box.
    if (!picked.id && text === '') {
      setFeedback({ type: 'error', message: 'Type an ingredient to add (e.g. “milk”).' });
      return;
    }
    const blankQty = qty.trim() === '';
    if (!blankQty && (!Number.isFinite(Number(qty)) || Number(qty) < 0)) {
      setFeedback({ type: 'error', message: 'Enter a valid amount, or leave it blank.' });
      return;
    }
    if (!householdId) return;

    setBusy(true);
    try {
      // Prefer an explicit dropdown pick that still matches the box; otherwise
      // resolve the typed text (match an existing ingredient, or create one).
      const usePick = picked.id && text.toLowerCase() === (picked.name ?? '').trim().toLowerCase();
      const target = usePick
        ? { canonicalId: picked.id as string, name: picked.name ?? 'Item', created: false }
        : await resolveOrCreateCanonical(householdId, text || (picked.name ?? ''));

      await add.mutateAsync({
        canonicalId: target.canonicalId,
        quantity: blankQty ? 0 : Number(qty),
        amountUnknown: blankQty,
        unit: unit.trim() || null,
        location,
      });

      setPicked({ id: null, name: null });
      setTyped('');
      setSeed('');
      setQty('');
      setUnit('');
      setFormKey((k) => k + 1);
      setFeedback({
        type: 'success',
        message: target.created
          ? `Added ${target.name} (new ingredient) to your ${location}.`
          : `Added ${target.name} to your ${location}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? `Couldn’t add that: ${err.message}`
            : 'Couldn’t add that — please try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Pantry</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            What you have on hand. Set it up once — later it updates as you shop and cook.
          </p>
        </div>
        <AddMenu
          label="Add item"
          methods={[
            {
              label: 'Add one item',
              icon: '✏️',
              description: 'Type or scan a single item',
              onSelect: () => setAddMode('single'),
            },
            {
              label: 'Bulk add from a list',
              icon: '📋',
              description: 'Paste a spreadsheet or list',
              onSelect: () => setAddMode('bulk'),
            },
          ]}
        />
      </div>

      {addMode === 'single' && (
      <form onSubmit={submitAdd} className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Add an item</span>
          <ScanButton size="sm" onResult={onScanned} />
        </div>
        <CanonicalCombobox
          key={formKey}
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
          placeholder="Type an ingredient…"
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
          <Button type="submit" disabled={busy || add.isPending}>
            {busy || add.isPending ? 'Adding…' : 'Add'}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Leave the amount blank if you have it but haven’t measured it — it’ll count as in stock
          and stay off your shopping list.
        </p>
        {feedback && (
          <p
            role="status"
            aria-live="polite"
            className={feedback.type === 'success' ? 'text-sm text-emerald-700' : 'text-destructive text-sm'}
          >
            {feedback.message}
          </p>
        )}
      </form>
      )}

      {addMode === 'bulk' && householdId && (
        <PantryBulkImport householdId={householdId} onClose={() => setAddMode('single')} />
      )}

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
  const [qty, setQty] = useState(item.amountUnknown ? '' : String(item.quantity));

  function commitQty() {
    // Cleared → back to "have some, amount unknown" (kept off the shopping list).
    if (qty.trim() === '') {
      if (!item.amountUnknown) update.mutate({ id: item.id, quantity: 0, amountUnknown: true });
      return;
    }
    // A typed amount quantifies the item (clears the unknown flag).
    const n = Number(qty);
    if (Number.isFinite(n) && n >= 0 && (n !== item.quantity || item.amountUnknown)) {
      update.mutate({ id: item.id, quantity: n, amountUnknown: false });
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
          placeholder={item.amountUnknown ? 'in stock' : undefined}
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
