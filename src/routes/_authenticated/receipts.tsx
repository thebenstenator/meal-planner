import { createFileRoute } from '@tanstack/react-router';
import { format } from 'date-fns';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEntitlement } from '@/features/billing/use-entitlement';
import { CanonicalCombobox } from '@/features/ingredients/components/canonical-combobox';
import { usePricingSettings, useStores } from '@/features/pricing/use-pricing';
import type { ReceiptLineDraft } from '@/features/receipts/api';
import { centsToDollars, dollarsToCents } from '@/features/receipts/money';
import {
  useDeleteTrip,
  useSaveTrip,
  useScanReceipt,
  useTrips,
} from '@/features/receipts/use-receipts';
import { fileToImage, ImportError } from '@/features/recipes/import';
import { formatCurrency } from '@/lib/utils/format-currency';

export const Route = createFileRoute('/_authenticated/receipts')({
  component: ReceiptsPage,
});

type Img = { media_type: string; data: string; preview: string };

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function ReceiptsPage() {
  const { isPremium, isLoading: entLoading } = useEntitlement();
  const scan = useScanReceipt();
  const save = useSaveTrip();
  const { data: stores } = useStores();
  const { data: settings } = usePricingSettings();

  const [images, setImages] = useState<Img[]>([]);
  const [lines, setLines] = useState<ReceiptLineDraft[] | null>(null);
  const [scannedStore, setScannedStore] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string>('');
  const [purchasedOn, setPurchasedOn] = useState(todayISO());
  const [total, setTotal] = useState('');
  const [error, setError] = useState<{ message: string; limitReached: boolean } | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

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
    if (images.length === 0) return;
    setError(null);
    setSaved(null);
    try {
      const { parsed, drafts } = await scan.mutateAsync(
        images.map(({ media_type, data }) => ({ media_type, data })),
      );
      setLines(drafts);
      setScannedStore(parsed.storeName);
      setPurchasedOn(parsed.purchasedOn ?? todayISO());
      setTotal(centsToDollars(parsed.totalCents));
      setStoreId(settings?.defaultStoreId ?? '');
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Could not read that receipt',
        limitReached: err instanceof ImportError && err.limitReached,
      });
    }
  }

  function updateLine(i: number, patch: Partial<ReceiptLineDraft>) {
    setLines((ls) => ls?.map((l, j) => (j === i ? { ...l, ...patch } : l)) ?? null);
  }

  function reset() {
    setImages([]);
    setLines(null);
    setTotal('');
    setError(null);
  }

  async function onSave() {
    const totalCents = dollarsToCents(total) ?? 0;
    await save.mutateAsync({
      storeId: storeId || null,
      purchasedOn,
      totalCents,
      note: null,
      lines: lines ?? [],
    });
    setSaved((lines ?? []).length);
    reset();
  }

  const matchedCount = (lines ?? []).filter((l) => l.canonicalId).length;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Scan a receipt</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Snap a grocery receipt — we’ll log the trip as actual spend and update your prices.
        </p>
      </div>

      {saved != null && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Trip saved with {saved} item{saved === 1 ? '' : 's'}. It’s in your spending now.
        </p>
      )}

      {!entLoading && !isPremium ? (
        <Paywall />
      ) : lines === null ? (
        <CaptureStep
          images={images}
          onAddFiles={addFiles}
          onRemove={(i) => setImages((prev) => prev.filter((_, j) => j !== i))}
          onScan={onScan}
          scanning={scan.isPending}
          error={error}
        />
      ) : (
        <ReviewStep
          lines={lines}
          scannedStore={scannedStore}
          stores={stores ?? []}
          storeId={storeId}
          setStoreId={setStoreId}
          purchasedOn={purchasedOn}
          setPurchasedOn={setPurchasedOn}
          total={total}
          setTotal={setTotal}
          matchedCount={matchedCount}
          updateLine={updateLine}
          onRemoveLine={(i) => setLines((ls) => ls?.filter((_, j) => j !== i) ?? null)}
          onSave={onSave}
          saving={save.isPending}
          onCancel={reset}
        />
      )}

      <TripLog />
    </main>
  );
}

function CaptureStep({
  images,
  onAddFiles,
  onRemove,
  onScan,
  scanning,
  error,
}: {
  images: Img[];
  onAddFiles: (files: FileList | null) => void;
  onRemove: (i: number) => void;
  onScan: () => void;
  scanning: boolean;
  error: { message: string; limitReached: boolean } | null;
}) {
  return (
    <div className="space-y-4">
      <label className="border-input hover:bg-accent block cursor-pointer rounded-lg border border-dashed p-6 text-center text-sm">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onAddFiles(e.target.files)}
        />
        Add receipt photos ({images.length}/6)
      </label>

      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <li key={i} className="relative">
              <img src={img.preview} alt={`Receipt ${i + 1}`} className="h-28 w-full rounded object-cover" />
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                className="bg-background absolute right-1 top-1 rounded-full border px-1.5 text-xs"
                onClick={() => onRemove(i)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="space-y-1 rounded-lg border p-4">
          <p className="font-medium">
            {error.limitReached ? 'Monthly AI limit reached' : 'Couldn’t read that receipt'}
          </p>
          <p className="text-muted-foreground text-sm">{error.message}</p>
        </div>
      )}

      <Button onClick={onScan} disabled={scanning || images.length === 0}>
        {scanning ? 'Reading receipt…' : 'Scan receipt'}
      </Button>
    </div>
  );
}

function ReviewStep({
  lines,
  scannedStore,
  stores,
  storeId,
  setStoreId,
  purchasedOn,
  setPurchasedOn,
  total,
  setTotal,
  matchedCount,
  updateLine,
  onRemoveLine,
  onSave,
  saving,
  onCancel,
}: {
  lines: ReceiptLineDraft[];
  scannedStore: string | null;
  stores: { id: string; name: string }[];
  storeId: string;
  setStoreId: (v: string) => void;
  purchasedOn: string;
  setPurchasedOn: (v: string) => void;
  total: string;
  setTotal: (v: string) => void;
  matchedCount: number;
  updateLine: (i: number, patch: Partial<ReceiptLineDraft>) => void;
  onRemoveLine: (i: number) => void;
  onSave: () => void;
  saving: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      {scannedStore && (
        <p className="text-muted-foreground text-sm">
          Read from <span className="font-medium">{scannedStore}</span> — pick the matching store
          below to update its prices.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Store</span>
          <select
            aria-label="Store"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          >
            <option value="">No store (log spend only)</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Date</span>
          <Input type="date" value={purchasedOn} onChange={(e) => setPurchasedOn(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Total ($)</span>
          <Input
            inputMode="decimal"
            placeholder="0.00"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </label>
      </div>

      <p className="text-muted-foreground text-xs">
        {lines.length} item{lines.length === 1 ? '' : 's'} · {matchedCount} matched.
        {storeId
          ? ' Matched items with a price update your store prices; highlighted (unmatched) ones still count toward the total but won’t update prices.'
          : ' Highlighted items are unmatched — pick a store and match them to also update prices.'}
      </p>

      <ul className="space-y-2">
        {lines.map((line, i) => {
          const needsMatch = !line.canonicalId;
          return (
          <li
            key={i}
            className={
              needsMatch
                ? 'space-y-1 rounded border border-amber-400 bg-amber-50 p-2'
                : 'space-y-1 rounded border p-2'
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground truncate text-xs">{line.raw}</span>
              <div className="flex shrink-0 items-center gap-2">
                {needsMatch ? (
                  <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                    no price match
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-emerald-700">✓ {line.canonicalName}</span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${line.raw}`}
                  className="text-muted-foreground text-xs"
                  onClick={() => onRemoveLine(i)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_3.5rem_3.5rem_4.5rem] gap-1">
              <CanonicalCombobox
                value={{ id: line.canonicalId, name: line.canonicalName }}
                seedName={line.parsedName}
                onSelect={(id, name) => updateLine(i, { canonicalId: id, canonicalName: name })}
                placeholder="Match…"
              />
              <Input
                aria-label={`Quantity for ${line.raw}`}
                inputMode="decimal"
                value={line.quantity ?? ''}
                onChange={(e) =>
                  updateLine(i, { quantity: e.target.value === '' ? null : Number(e.target.value) })
                }
                placeholder="qty"
                className="h-9"
              />
              <Input
                aria-label={`Unit for ${line.raw}`}
                value={line.unit ?? ''}
                onChange={(e) => updateLine(i, { unit: e.target.value || null })}
                placeholder="unit"
                className="h-9"
              />
              <Input
                aria-label={`Price for ${line.raw}`}
                inputMode="decimal"
                value={centsToDollars(line.priceCents)}
                onChange={(e) => updateLine(i, { priceCents: dollarsToCents(e.target.value) })}
                placeholder="$"
                className="h-9"
              />
            </div>
          </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save trip'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function TripLog() {
  const { data: trips, isLoading } = useTrips();
  const del = useDeleteTrip();

  if (isLoading || !trips || trips.length === 0) return null;

  return (
    <section>
      <h2 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
        Recent trips
      </h2>
      <ul className="divide-y rounded-lg border">
        {trips.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium">
                {format(new Date(`${t.purchasedOn}T00:00:00`), 'MMM d, yyyy')}
                {t.storeName ? ` · ${t.storeName}` : ''}
              </div>
              <div className="text-muted-foreground text-xs">
                {t.itemCount} item{t.itemCount === 1 ? '' : 's'}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium tabular-nums">{formatCurrency(t.totalCents)}</span>
              <button
                type="button"
                aria-label={`Delete trip on ${t.purchasedOn}`}
                className="text-muted-foreground text-xs"
                onClick={() => del.mutate(t.id)}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Paywall() {
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="font-medium">Receipt scanning is a premium feature</p>
      <p className="text-muted-foreground text-sm">
        Tracking spend by hand is always free. Scanning a receipt to log a trip and update your
        prices automatically is part of premium.
      </p>
    </div>
  );
}
