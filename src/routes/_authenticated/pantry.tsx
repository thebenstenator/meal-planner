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
import type { ScannedProduct } from '@/features/scanner/open-food-facts';
import type { PackageLine, PantryItem, PantryLocation } from '@/features/pantry/api';
import { PantryBulkImport } from '@/features/pantry/components/bulk-import';
import { usePantry, usePantryMutations } from '@/features/pantry/use-pantry';
import { parseTypedDate, toISO } from '@/features/planner/dates';
import { useHousehold } from '@/features/household/use-household';

export const Route = createFileRoute('/_authenticated/pantry')({
  component: PantryPage,
});

const LOCATIONS: PantryLocation[] = ['pantry', 'fridge', 'freezer'];

/** A container-size row while it's being typed in the add form or the row editor. */
interface DraftPkg {
  count: string;
  size: string;
  unit: string;
}

const EMPTY_PKG: DraftPkg = { count: '1', size: '', unit: '' };

/** Parse draft rows into clean PackageLine[], dropping any that aren't complete. */
function parseDraftPackages(drafts: DraftPkg[]): PackageLine[] {
  return drafts.flatMap((d) => {
    const size = Number(d.size);
    const count = Number(d.count);
    const unit = d.unit.trim();
    if (!unit || !Number.isFinite(size) || size <= 0 || !Number.isInteger(count) || count <= 0) {
      return [];
    }
    return [{ size, unit, count }];
  });
}

/** "2×32oz · 2×16oz" for a row's sealed containers. */
function formatPackages(packages: PackageLine[]): string {
  return packages.map((p) => `${p.count}×${p.size}${p.unit}`).join(' · ');
}

/** Trim floaty amounts to at most 2 decimals for display. */
function formatAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

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
  // Container sizes, e.g. 2×32oz + 2×16oz. When any are filled they define the
  // quantity and the plain amount above is ignored.
  const [pkgs, setPkgs] = useState<DraftPkg[]>([]);
  const [addMode, setAddMode] = useState<'single' | 'many'>('single');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  // Seed text (e.g. from a barcode scan) to preload the combobox with.
  const [seed, setSeed] = useState('');
  // Bumped after each add / scan to remount the combobox (its text is internal).
  const [formKey, setFormKey] = useState(0);

  function onScanned(product: ScannedProduct) {
    setSeed(product.name);
    setTyped(product.name);
    setPicked({ id: null, name: null });
    // Barcode carried a package size → start a container row with it.
    if (product.size) {
      setPkgs([{ count: '1', size: String(product.size.quantity), unit: product.size.unit }]);
      setUnit(product.size.unit);
    }
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
    const packages = parseDraftPackages(pkgs);
    const hasPackages = packages.length > 0;
    const blankQty = qty.trim() === '';
    if (!hasPackages && !blankQty && (!Number.isFinite(Number(qty)) || Number(qty) < 0)) {
      setFeedback({ type: 'error', message: 'Enter a valid amount, or leave it blank.' });
      return;
    }
    const expiresOn = parseTypedDate(expires);
    if (expires.trim() !== '' && expiresOn === null) {
      setFeedback({
        type: 'error',
        message: 'Couldn’t read that expiry date — try 8/20 or 2026-08-20.',
      });
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
        // With container sizes the quantity is their sum; unit follows the first.
        quantity: blankQty ? 0 : Number(qty),
        amountUnknown: hasPackages ? false : blankQty,
        unit: hasPackages ? packages[0]!.unit : unit.trim() || null,
        location,
        expiresOn,
        packages: hasPackages ? packages : undefined,
      });

      setPicked({ id: null, name: null });
      setTyped('');
      setSeed('');
      setQty('');
      setUnit('');
      setExpires('');
      setPkgs([]);
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
            type="text"
            inputMode="numeric"
            placeholder="8/20 or 2026-08-20"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="h-9 w-44"
          />
          <span className="text-muted-foreground text-xs">optional</span>
        </div>

        <PackageBuilder drafts={pkgs} setDrafts={setPkgs} />

        <p className="text-muted-foreground text-xs">
          Track container sizes (e.g. 2×32 oz + 2×16 oz) and they’ll set the amount for you.
          Otherwise leave the amount blank if you have it but haven’t measured it — it stays off
          your shopping list. An expiry date powers “use it up” nudges and reminders.
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
  // Owned here so the row's "⋮" menu can open each editor.
  const [editingExpiry, setEditingExpiry] = useState(false);
  const [editingPackages, setEditingPackages] = useState(false);
  const packaged = item.packages.length > 0;

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
    <li className="p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.canonicalName}</span>
          {packaged && (
            <span className="text-muted-foreground block text-xs">
              {formatPackages(item.packages)}
              {item.looseQuantity > 0 &&
                ` · +${formatAmount(item.looseQuantity)}${item.unit ?? ''} opened`}
            </span>
          )}
          <ExpiryControl item={item} editing={editingExpiry} setEditing={setEditingExpiry} />
        </div>
        <div className="flex items-center gap-1">
          {packaged ? (
            <span
              className="text-sm tabular-nums"
              aria-label={`Total ${item.canonicalName}`}
            >
              {formatAmount(item.quantity)} {item.unit ?? ''}
            </span>
          ) : (
            <>
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
            </>
          )}
          <RowMenu
            label={`Actions for ${item.canonicalName}`}
            actions={[
              {
                label: item.expiresOn ? 'Change expiry' : 'Add expiry',
                onSelect: () => setEditingExpiry(true),
              },
              {
                label: packaged ? 'Edit sizes' : 'Add sizes',
                onSelect: () => setEditingPackages(true),
              },
              { label: 'Remove', onSelect: () => remove.mutate(item.id), destructive: true },
            ]}
          />
        </div>
      </div>
      {editingPackages && (
        <PackageEditor item={item} onClose={() => setEditingPackages(false)} />
      )}
    </li>
  );
}

/** Repeated "[count] × [size] [unit]" rows for entering container sizes. */
function PackageBuilder({
  drafts,
  setDrafts,
}: {
  drafts: DraftPkg[];
  setDrafts: (d: DraftPkg[]) => void;
}) {
  function patch(i: number, next: Partial<DraftPkg>) {
    setDrafts(drafts.map((d, idx) => (idx === i ? { ...d, ...next } : d)));
  }
  return (
    <div className="space-y-2">
      {drafts.map((d, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            aria-label={`Container count ${i + 1}`}
            inputMode="numeric"
            value={d.count}
            onChange={(e) => patch(i, { count: e.target.value })}
            className="h-9 w-14"
          />
          <span className="text-muted-foreground text-sm">×</span>
          <Input
            aria-label={`Container size ${i + 1}`}
            inputMode="decimal"
            placeholder="size"
            value={d.size}
            onChange={(e) => patch(i, { size: e.target.value })}
            className="h-9 w-20"
          />
          <Input
            aria-label={`Container unit ${i + 1}`}
            placeholder="unit"
            value={d.unit}
            onChange={(e) => patch(i, { unit: e.target.value })}
            className="h-9 w-20"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove size ${i + 1}`}
            onClick={() => setDrafts(drafts.filter((_, idx) => idx !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setDrafts([...drafts, { ...EMPTY_PKG }])}
      >
        + add a size
      </Button>
    </div>
  );
}

/** In-row editor for an item's container sizes; saving resets the total to their sum. */
function PackageEditor({ item, onClose }: { item: PantryItem; onClose: () => void }) {
  const { setPackages } = usePantryMutations();
  const [drafts, setDrafts] = useState<DraftPkg[]>(
    item.packages.length > 0
      ? item.packages.map((p) => ({ count: String(p.count), size: String(p.size), unit: p.unit }))
      : [{ ...EMPTY_PKG, unit: item.unit ?? '' }],
  );

  function save() {
    const lines = parseDraftPackages(drafts);
    setPackages.mutate(
      {
        id: item.id,
        lines,
        unit: lines[0]?.unit ?? item.unit,
        info: {
          densityGPerMl: item.densityGPerMl ?? undefined,
          countToGram: item.countToGram ?? undefined,
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border p-2">
      <PackageBuilder drafts={drafts} setDrafts={setDrafts} />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={setPackages.isPending}>
          {setPackages.isPending ? 'Saving…' : 'Save sizes'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
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
  const [invalid, setInvalid] = useState(false);

  // Free-typed, not a native picker: commit on blur or Enter. Blank clears it; a
  // date we can read is saved as ISO; anything unreadable keeps the editor open
  // with a hint rather than silently dropping what was typed.
  function commit(next: string) {
    if (next.trim() === '') {
      if (item.expiresOn != null) update.mutate({ id: item.id, expiresOn: null });
      setEditing(false);
      return;
    }
    const iso = parseTypedDate(next);
    if (iso === null) {
      setInvalid(true);
      return;
    }
    if (iso !== (item.expiresOn ?? null)) update.mutate({ id: item.id, expiresOn: iso });
    setEditing(false);
  }

  if (editing) {
    return (
      <span className="mt-1 flex flex-wrap items-center gap-1">
        <Input
          type="text"
          inputMode="numeric"
          autoFocus
          placeholder="8/20 or 2026-08-20"
          aria-label={`Expiry date for ${item.canonicalName}`}
          aria-invalid={invalid}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          onBlur={() => commit(value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(value);
            }
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-7 w-40 text-xs"
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
        {invalid && (
          <span className="text-destructive text-xs">Couldn’t read that date.</span>
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
