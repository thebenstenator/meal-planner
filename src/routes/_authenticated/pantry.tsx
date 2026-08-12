import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RowMenu } from '@/components/ui/row-menu';
import { cn } from '@/lib/utils/cn';
import { daysBetween, expiryLabel } from '@/features/insights/insights';
import { CanonicalCombobox } from '@/features/ingredients/components/canonical-combobox';
import { resolveOrCreateCanonical } from '@/features/ingredients/resolve';
import { ScanButton } from '@/features/scanner/scan-button';
import type { PantryItem, PantryLocation } from '@/features/pantry/api';
import { PantryBulkImport } from '@/features/pantry/components/bulk-import';
import { usePantry, usePantryMutations } from '@/features/pantry/use-pantry';
import { toISO } from '@/features/planner/dates';
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
  const [expires, setExpires] = useState('');
  const [addMode, setAddMode] = useState<'single' | 'many'>('single');
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
        expiresOn: expires || null,
      });

      setPicked({ id: null, name: null });
      setTyped('');
      setSeed('');
      setQty('');
      setUnit('');
      setExpires('');
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
      <div>
        <h1 className="text-2xl font-semibold">Pantry</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          What you have on hand. Set it up once — later it updates as you shop and cook.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex rounded-md border p-0.5 text-sm">
            {(['single', 'many'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAddMode(m)}
                className={cn(
                  'rounded px-3 py-1',
                  addMode === m ? 'bg-primary text-primary-foreground' : '',
                )}
              >
                {m === 'single' ? 'One item' : 'Many items'}
              </button>
            ))}
          </div>
          {addMode === 'single' && <ScanButton size="sm" onResult={onScanned} />}
        </div>

      {addMode === 'single' && (
      <form onSubmit={submitAdd} className="space-y-2">
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
        <div className="flex items-center gap-2">
          <label htmlFor="pantry-expires" className="text-muted-foreground text-xs">
            Expires
          </label>
          <Input
            id="pantry-expires"
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="h-9 w-40"
          />
          <span className="text-muted-foreground text-xs">optional</span>
        </div>
        <p className="text-muted-foreground text-xs">
          Leave the amount blank if you have it but haven’t measured it — it’ll count as in stock
          and stay off your shopping list. An expiry date is what powers “use it up” nudges and
          reminders.
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

      {addMode === 'many' && householdId && (
        <PantryBulkImport householdId={householdId} embedded />
      )}
      </div>

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
  // Owned here so the row's "⋮" menu can open the expiry editor.
  const [editingExpiry, setEditingExpiry] = useState(false);

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
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.canonicalName}</span>
        <ExpiryControl item={item} editing={editingExpiry} setEditing={setEditingExpiry} />
      </div>
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
        <RowMenu
          label={`Actions for ${item.canonicalName}`}
          actions={[
            {
              label: item.expiresOn ? 'Change expiry' : 'Add expiry',
              onSelect: () => setEditingExpiry(true),
            },
            { label: 'Remove', onSelect: () => remove.mutate(item.id), destructive: true },
          ]}
        />
      </div>
    </li>
  );
}

/**
 * The expiry date on a pantry row: a quiet "expires in 3d" you can tap to change.
 * Rows without a date show nothing at all — most items never get one, and the
 * row's "⋮" menu is where you add it. Open state is owned by the row so the menu
 * can drive it.
 */
function ExpiryControl({
  item,
  editing,
  setEditing,
}: {
  item: PantryItem;
  editing: boolean;
  setEditing: (open: boolean) => void;
}) {
  const { update } = usePantryMutations();
  const [value, setValue] = useState(item.expiresOn ?? '');

  // Same idiom as the quantity field above: commit on blur or Enter, so a
  // half-typed date never lands and the native mobile picker works normally.
  function commit(next: string) {
    const expiresOn = next || null;
    if (expiresOn !== (item.expiresOn ?? null)) update.mutate({ id: item.id, expiresOn });
    setEditing(false);
  }

  if (editing) {
    return (
      <span className="mt-1 flex items-center gap-1">
        <Input
          type="date"
          autoFocus
          aria-label={`Expiry date for ${item.canonicalName}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => commit(value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(value);
            }
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-7 w-36 text-xs"
        />
        {item.expiresOn && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-1 text-xs"
            aria-label={`Clear expiry for ${item.canonicalName}`}
            // Beat the input's blur, which would otherwise commit and unmount us first.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setValue('');
              commit('');
            }}
          >
            clear
          </Button>
        )}
      </span>
    );
  }

  if (!item.expiresOn) return null;

  const daysLeft = daysBetween(toISO(new Date()), item.expiresOn);
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`Change expiry for ${item.canonicalName}`}
      className={cn(
        'mt-0.5 text-xs underline-offset-2 hover:underline',
        daysLeft <= 0 ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {expiryLabel(daysLeft)}
    </button>
  );
}
