// The end of a shopping trip: log what you spent, reconcile a receipt if you
// want the detail, then clear the list.
//
// Ordering is the whole point. The checked-off items are the only record of what
// was bought, so clearing them is offered last — after the trip is logged — and
// never as a standalone step inside this flow.

import { format } from 'date-fns';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEntitlement } from '@/features/billing/use-entitlement';
import { shouldTrackInPantry } from '@/features/pantry/track-decision';
import {
  useAddCanonicalToPantry,
  useApplyPurchaseToPantry,
  usePantryPrefs,
} from '@/features/pantry/use-pantry';
import { useListPricing } from '@/features/pricing/use-list-pricing';
import type { ReceiptLineDraft } from '@/features/receipts/api';
import { centsToDollars, dollarsToCents } from '@/features/receipts/money';
import { useSaveTrip, useScanReceipt } from '@/features/receipts/use-receipts';
import { fileToImage, ImportError } from '@/features/recipes/import';
import type { ShoppingItem } from '@/features/shopping-list/api';
import { reconcileTrip, type TripReconciliation } from '@/features/shopping-list/reconcile-trip';
import { useClearCheckedItems, useToggleItem } from '@/features/shopping-list/use-shopping-list';
import { formatCurrency } from '@/lib/utils/format-currency';

type Img = { media_type: string; data: string; preview: string };
type Recon = TripReconciliation<ReceiptLineDraft, ShoppingItem>;

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * "Finish trip", shown once anything on the list is checked off. Opens the
 * closeout; renders nothing on an untouched list so it stays out of the way
 * while you're still shopping.
 *
 * The bare "clear checked" sits beside it for the trips you don't want to log —
 * a running list you topped up, where the spend isn't worth recording.
 */
export function FinishTrip({
  listId,
  listName,
  items,
}: {
  listId: string;
  listName: string;
  items: ShoppingItem[];
}) {
  const [open, setOpen] = useState(false);
  const checkedCount = items.filter((i) => i.isChecked).length;
  if (checkedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => setOpen(true)} data-testid="finish-trip">
        Finish trip
      </Button>
      <ClearChecked listId={listId} count={checkedCount} />
      {/* Mounted only while open so every visit starts clean rather than
          resuming a half-typed total from the last trip. */}
      {open && (
        <FinishTripDialog
          listId={listId}
          listName={listName}
          items={items}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Clear the checked items without logging anything. Confirms first — this is
 * the one place that throws away the record of what was bought, and there's no
 * undo.
 */
function ClearChecked({ listId, count }: { listId: string; count: number }) {
  const clear = useClearCheckedItems(listId);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        className="text-muted-foreground text-xs underline"
        onClick={() => setConfirming(true)}
      >
        clear {count} checked
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Clear without logging the spend?</span>
      <Button
        size="sm"
        variant="destructive"
        className="h-7"
        disabled={clear.isPending}
        onClick={async () => {
          await clear.mutateAsync();
          setConfirming(false);
        }}
      >
        {clear.isPending ? 'Clearing…' : 'Clear'}
      </Button>
      <Button size="sm" variant="ghost" className="h-7" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  );
}

function FinishTripDialog({
  listId,
  listName,
  items,
  onClose,
}: {
  listId: string;
  listName: string;
  items: ShoppingItem[];
  onClose: () => void;
}) {
  const pricing = useListPricing(items);
  const { isPremium, isLoading: entLoading } = useEntitlement();
  const { data: pantryPrefs } = usePantryPrefs();

  const scan = useScanReceipt();
  const save = useSaveTrip();
  const toggle = useToggleItem(listId);
  const applyToPantry = useApplyPurchaseToPantry();
  const addToPantry = useAddCanonicalToPantry();
  const clearChecked = useClearCheckedItems(listId);

  const checked = items.filter((i) => i.isChecked);
  const estimateCents = checked.reduce(
    (sum, it) => sum + (it.actualCostCents ?? pricing.byItemId.get(it.id)?.estimatedCents ?? 0),
    0,
  );

  const [step, setStep] = useState<'entry' | 'review' | 'logged'>('entry');
  const [total, setTotal] = useState('');
  const [pricesOpen, setPricesOpen] = useState(false);
  // Seeded only from prices the shopper actually recorded. Estimates stay out:
  // anything in here can become a price_record, and a guess written as a paid
  // price would feed back into future estimates as if it were real.
  const [itemPrices, setItemPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      checked
        .filter((it) => it.actualCostCents != null)
        .map((it) => [it.id, centsToDollars(it.actualCostCents as number)]),
    ),
  );
  const [images, setImages] = useState<Img[]>([]);
  const [recon, setRecon] = useState<Recon | null>(null);
  const [receiptLines, setReceiptLines] = useState<ReceiptLineDraft[]>([]);
  const [receiptDate, setReceiptDate] = useState<string | null>(null);
  const [missedSel, setMissedSel] = useState<Record<string, boolean>>({});
  const [offListSel, setOffListSel] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<{ message: string; limitReached: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const totalCents = dollarsToCents(total);
  const stillChecked = items.filter((i) => i.isChecked).length;

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const next = await Promise.all(
      [...files].map(async (f) => {
        const img = await fileToImage(f);
        return { media_type: img.media_type, data: img.data, preview: img.preview };
      }),
    );
    setImages((prev) => [...prev, ...next].slice(0, 6));
  }

  async function onScan() {
    setError(null);
    try {
      const { parsed, drafts } = await scan.mutateAsync(
        images.map((i) => ({ media_type: i.media_type, data: i.data })),
      );
      const r = reconcileTrip(drafts, items);
      setReceiptLines(drafts);
      setRecon(r);
      setReceiptDate(parsed.purchasedOn);
      if (parsed.totalCents != null) setTotal(centsToDollars(parsed.totalCents));
      // Everything the receipt says you bought but didn't tick is pre-selected —
      // the receipt is the better witness. Off-list items follow the same
      // food/non-food call as check-off, so a normal trip is one tap.
      setMissedSel(Object.fromEntries(r.missed.map(({ item }) => [item.id, true])));
      setOffListSel(
        Object.fromEntries(
          r.offList.map((line, i) => [
            i,
            shouldTrackInPantry(
              { canonicalId: line.canonicalId, category: null, displayName: line.raw },
              pantryPrefs ?? {},
            ),
          ]),
        ),
      );
      setStep('review');
    } catch (err) {
      const e = err as ImportError;
      setError({ message: e.message, limitReached: e instanceof ImportError && e.limitReached });
    }
  }

  /** The checked list items as trip lines, priced only where a price was given. */
  function linesFromList(): ReceiptLineDraft[] {
    return checked.map((it) => ({
      raw: it.displayName,
      parsedName: it.displayName,
      canonicalId: it.canonicalId,
      canonicalName: it.canonicalId ? it.displayName : null,
      // What was actually bought, when the list worked it out in packages.
      quantity: it.purchase ? it.purchase.totalPurchaseQuantity : it.totalQuantity,
      unit: it.purchase ? it.purchase.packageUnit : it.unit,
      priceCents: dollarsToCents(itemPrices[it.id] ?? ''),
      needsReview: false,
    }));
  }

  async function onLog() {
    if (totalCents == null) return;
    setBusy(true);
    setError(null);
    try {
      await save.mutateAsync({
        storeId: pricing.storeId,
        purchasedOn: receiptDate ?? todayISO(),
        totalCents,
        note: listName,
        lines: recon ? receiptLines : linesFromList(),
      });

      if (recon) {
        // Tick what the receipt caught you missing, and run it through the same
        // pantry gate a manual tick would have.
        for (const { item } of recon.missed) {
          if (!missedSel[item.id]) continue;
          toggle.mutate({ itemId: item.id, checked: true });
          applyToPantry.mutate({ item, checked: true });
        }
        const adds = recon.offList
          .map((line, i) => ({ line, i }))
          .filter(({ line, i }) => offListSel[i] && line.canonicalId)
          .map(({ line }) => ({
            canonicalId: line.canonicalId as string,
            quantity: line.quantity,
            unit: line.unit,
          }));
        if (adds.length > 0) await addToPantry.mutateAsync(adds);
      }
      setStep('logged');
    } catch (err) {
      setError({ message: (err as Error).message, limitReached: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="bg-background w-full max-w-md rounded-lg border shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">
            {step === 'logged' ? 'Trip logged' : step === 'review' ? 'Check the receipt' : 'Finish trip'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-4 p-5">
          {step === 'logged' ? (
            <LoggedStep
              stillChecked={stillChecked}
              clearing={clearChecked.isPending}
              onClear={async () => {
                await clearChecked.mutateAsync();
                onClose();
              }}
              onKeep={onClose}
            />
          ) : (
            <>
              {step === 'entry' ? (
                <p className="text-muted-foreground text-sm">
                  {checked.length} item{checked.length === 1 ? '' : 's'} checked off
                  {estimateCents > 0 && <> · est {formatCurrency(estimateCents)}</>}
                </p>
              ) : (
                recon && <ReviewSummary recon={recon} />
              )}

              <label className="block space-y-1 text-sm">
                <span className="font-medium">What did you spend?</span>
                <div className="flex items-center gap-1">
                  <span>$</span>
                  <Input
                    autoFocus
                    inputMode="decimal"
                    aria-label="Trip total"
                    // Left blank on purpose: prefilling the estimate makes it far
                    // too easy to log a guess as real spend, which is exactly the
                    // number the budget is supposed to be honest about.
                    placeholder={estimateCents > 0 ? centsToDollars(estimateCents) : '0.00'}
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    className="h-9 w-28"
                  />
                  {estimateCents > 0 && (
                    <span className="text-muted-foreground text-xs">
                      est {formatCurrency(estimateCents)}
                    </span>
                  )}
                </div>
              </label>

              {step === 'entry' && (
                <PricePass
                  items={checked}
                  open={pricesOpen}
                  onToggleOpen={() => setPricesOpen((v) => !v)}
                  values={itemPrices}
                  onChange={(id, v) => setItemPrices((prev) => ({ ...prev, [id]: v }))}
                  hasStore={!!pricing.storeId}
                />
              )}

              {step === 'review' && recon && (
                <ReviewLists
                  recon={recon}
                  missedSel={missedSel}
                  onMissed={(id, v) => setMissedSel((p) => ({ ...p, [id]: v }))}
                  offListSel={offListSel}
                  onOffList={(i, v) => setOffListSel((p) => ({ ...p, [i]: v }))}
                />
              )}

              {error && (
                <p className="text-destructive text-sm">
                  {error.message}
                  {error.limitReached && ' — the free scan limit resets next month.'}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={onLog} disabled={totalCents == null || busy}>
                  {busy ? 'Logging…' : 'Log trip'}
                </Button>
                {step === 'entry' && !entLoading && (
                  <ScanEntry
                    isPremium={isPremium}
                    images={images}
                    scanning={scan.isPending}
                    onAddFiles={addFiles}
                    onScan={onScan}
                  />
                )}
              </div>
              {totalCents == null && (
                <p className="text-muted-foreground text-xs">
                  Enter the total from your receipt to log this trip.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The optional per-item pass — folded away, since the total alone is enough. */
function PricePass({
  items,
  open,
  onToggleOpen,
  values,
  onChange,
  hasStore,
}: {
  items: ShoppingItem[];
  open: boolean;
  onToggleOpen: () => void;
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  hasStore: boolean;
}) {
  return (
    <div className="rounded border">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="hover:bg-accent flex w-full items-center justify-between px-3 py-2 text-left text-sm"
      >
        <span>Add prices (optional)</span>
        <span className="text-muted-foreground text-xs">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t p-3">
          <p className="text-muted-foreground text-xs">
            {hasStore
              ? 'Anything you fill in sharpens future estimates for your store. Skip what you don’t care about.'
              : 'Set a default store to also turn these into price history.'}
          </p>
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{it.displayName}</span>
              <span className="text-muted-foreground">$</span>
              <Input
                inputMode="decimal"
                aria-label={`Price paid for ${it.displayName}`}
                value={values[it.id] ?? ''}
                onChange={(e) => onChange(it.id, e.target.value)}
                className="h-8 w-20"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScanEntry({
  isPremium,
  images,
  scanning,
  onAddFiles,
  onScan,
}: {
  isPremium: boolean;
  images: Img[];
  scanning: boolean;
  onAddFiles: (files: FileList | null) => void;
  onScan: () => void;
}) {
  if (!isPremium) {
    return (
      <span className="text-muted-foreground text-xs">
        Scanning a receipt fills all of this in — it’s a premium feature.
      </span>
    );
  }
  if (images.length === 0) {
    return (
      <label className="hover:bg-accent cursor-pointer rounded-md border px-3 py-2 text-sm">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onAddFiles(e.target.files)}
        />
        Scan receipt
      </label>
    );
  }
  return (
    <Button variant="outline" onClick={onScan} disabled={scanning}>
      {scanning ? 'Reading…' : `Read ${images.length} photo${images.length === 1 ? '' : 's'}`}
    </Button>
  );
}

function ReviewSummary({ recon }: { recon: Recon }) {
  return (
    <p className="text-muted-foreground text-sm">
      {recon.confirmed.length} matched what you checked off
      {recon.missed.length > 0 && <> · {recon.missed.length} you missed</>}
      {recon.offList.length > 0 && <> · {recon.offList.length} not on the list</>}
    </p>
  );
}

function ReviewLists({
  recon,
  missedSel,
  onMissed,
  offListSel,
  onOffList,
}: {
  recon: Recon;
  missedSel: Record<string, boolean>;
  onMissed: (id: string, value: boolean) => void;
  offListSel: Record<number, boolean>;
  onOffList: (index: number, value: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      {recon.missed.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-medium">On the receipt, not checked off</h3>
          <p className="text-muted-foreground text-xs">Tick these off too?</p>
          {recon.missed.map(({ item }) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!missedSel[item.id]}
                onChange={(e) => onMissed(item.id, e.target.checked)}
              />
              <span className="min-w-0 flex-1 truncate">{item.displayName}</span>
            </label>
          ))}
        </section>
      )}

      {recon.offList.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-medium">Not on your list</h3>
          <p className="text-muted-foreground text-xs">Add these to your pantry?</p>
          {recon.offList.map((line, i) => (
            <label
              key={`${line.raw}-${i}`}
              className="flex items-center gap-2 text-sm"
              // Nothing to add without a canonical ingredient — the line still
              // counts toward the trip total, it just can't be stocked.
              title={line.canonicalId ? undefined : 'Not a recognised ingredient'}
            >
              <input
                type="checkbox"
                disabled={!line.canonicalId}
                checked={!!offListSel[i] && !!line.canonicalId}
                onChange={(e) => onOffList(i, e.target.checked)}
              />
              <span className="min-w-0 flex-1 truncate">{line.raw}</span>
              {!line.canonicalId && (
                <span className="text-muted-foreground text-xs">not recognised</span>
              )}
            </label>
          ))}
        </section>
      )}

      {recon.unreceipted.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-medium">Checked off, but not on the receipt</h3>
          <p className="text-muted-foreground text-xs">
            Left as-is — you may have a second receipt, or ticked one by mistake.
          </p>
          <p className="text-sm">{recon.unreceipted.map((i) => i.displayName).join(', ')}</p>
        </section>
      )}
    </div>
  );
}

function LoggedStep({
  stillChecked,
  clearing,
  onClear,
  onKeep,
}: {
  stillChecked: number;
  clearing: boolean;
  onClear: () => void;
  onKeep: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Saved to your spending.
      </p>
      {stillChecked > 0 ? (
        <>
          <p className="text-sm">
            Clear the {stillChecked} checked item{stillChecked === 1 ? '' : 's'} off this list?
            Anything you didn’t buy stays.
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={onClear} disabled={clearing}>
              {clearing ? 'Clearing…' : `Clear ${stillChecked}`}
            </Button>
            <Button variant="ghost" onClick={onKeep}>
              Keep them
            </Button>
          </div>
        </>
      ) : (
        <Button onClick={onKeep}>Done</Button>
      )}
    </div>
  );
}
