import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CanonicalCombobox } from '@/features/ingredients/components/canonical-combobox';
import { isLowStock } from '@/features/pantry/low-stock';
import { ScanButton } from '@/features/scanner/scan-button';
import {
  useApplyPurchaseToPantry,
  usePantry,
  usePantryMutations,
} from '@/features/pantry/use-pantry';
import { useAddPrice } from '@/features/pricing/use-pricing';
import { useListPricing, type ItemPricing } from '@/features/pricing/use-list-pricing';
import type { ShoppingItem } from '@/features/shopping-list/api';
import { groupByCategory, type ShoppingCategory } from '@/features/shopping-list/categories';
import { CategoryManager } from '@/features/shopping-list/components/category-manager';
import { CategorySelect } from '@/features/shopping-list/components/category-select';
import { useShoppingCategories } from '@/features/shopping-list/use-categories';
import {
  useGenerateList,
  useItemEdits,
  useSetActualCost,
  useSetConversion,
  useSetItemCategory,
  useShoppingList,
  useToggleItem,
} from '@/features/shopping-list/use-shopping-list';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format-currency';

export const Route = createFileRoute('/_authenticated/shopping-list/$listId')({
  component: ShoppingListDetail,
});

function trim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function ShoppingListDetail() {
  const { listId } = Route.useParams();
  const { data, isLoading, isError } = useShoppingList(listId);
  const toggle = useToggleItem(listId);
  const edits = useItemEdits(listId);
  const setConv = useSetConversion();
  const regenerate = useGenerateList();
  const addPrice = useAddPrice();
  const setActual = useSetActualCost(listId);
  const setCategory = useSetItemCategory(listId);
  const { categories, isLoading: categoriesLoading } = useShoppingCategories();
  const [managingCategories, setManagingCategories] = useState(false);
  const applyToPantry = useApplyPurchaseToPantry();
  const { data: pantry } = usePantry();
  const pantryMut = usePantryMutations();
  const pricing = useListPricing(data?.items ?? []);

  if (isLoading) return <Centered>Loading…</Centered>;
  if (isError || !data) return <Centered>Couldn’t load this list.</Centered>;

  const { summary, items } = data;
  // Grouped into the household's store sections, in the order they shop them.
  const sections = groupByCategory(items, categories);

  // Running low: pantry items below the restock line, not muted, and not already
  // on this list (you're already buying those).
  const onList = new Set(items.map((i) => i.canonicalId).filter((id): id is string => !!id));
  const lowItems = (pantry ?? []).filter(
    (p) => !p.amountUnknown && !p.restockMuted && !onList.has(p.canonicalId) && isLowStock(p),
  );

  // What's been bought so far: actual price where recorded, else the estimate.
  const checkedCents = items.reduce(
    (sum, it) =>
      it.isChecked
        ? sum + (it.actualCostCents ?? pricing.byItemId.get(it.id)?.estimatedCents ?? 0)
        : sum,
    0,
  );

  async function onRegenerate() {
    if (!summary.dateRangeStart || !summary.dateRangeEnd) return;
    await regenerate.mutateAsync({
      name: summary.name,
      start: summary.dateRangeStart,
      end: summary.dateRangeEnd,
      listId,
    });
  }

  async function setConversion(canonicalId: string, density: number) {
    await setConv.mutateAsync({ canonicalId, densityGPerMl: density });
    await onRegenerate();
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{summary.name}</h1>
          <p className="text-muted-foreground text-sm">
            {summary.isRunning
              ? 'Ongoing — jot anything you need'
              : `${summary.dateRangeStart} → ${summary.dateRangeEnd}`}{' '}
            · {items.length} items
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManagingCategories((v) => !v)}
            aria-expanded={managingCategories}
          >
            Categories
          </Button>
          {!summary.isRunning && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={regenerate.isPending}
            >
              {regenerate.isPending ? 'Regenerating…' : 'Regenerate'}
            </Button>
          )}
        </div>
      </div>

      {managingCategories &&
        (categoriesLoading ? (
          <p className="text-muted-foreground text-sm">Loading categories…</p>
        ) : (
          <CategoryManager categories={categories} onClose={() => setManagingCategories(false)} />
        ))}

      <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
        <div className="flex gap-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Projected total
            </div>
            <div className="text-xl font-semibold" data-testid="projected-total">
              {formatCurrency(pricing.projectedTotalCents)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Spent</div>
            <div className="text-xl font-semibold" data-testid="spent-total">
              {formatCurrency(checkedCents)}
            </div>
          </div>
        </div>
        <div className="text-muted-foreground text-right text-xs">
          {!pricing.storeId && <div>Set a default store to price items.</div>}
          {pricing.storeId && pricing.unpricedCount > 0 && (
            <div>{pricing.unpricedCount} item(s) unpriced</div>
          )}
          {pricing.staleCount > 0 && <div>{pricing.staleCount} stale price(s)</div>}
        </div>
      </div>

      {lowItems.length > 0 && (
        <section className="rounded-lg border border-amber-300/60 bg-amber-50/40 p-3">
          <h2 className="text-sm font-medium">Running low</h2>
          <p className="text-muted-foreground mb-2 text-xs">
            From your pantry — add what you want to restock.
          </p>
          <ul className="space-y-1.5">
            {lowItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{item.canonicalName}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    className="h-7"
                    onClick={() => {
                      edits.addItem.mutate({
                        name: item.canonicalName,
                        quantity: item.packageQuantity,
                        unit: item.packageUnit,
                      });
                      pantryMut.mute.mutate(item.id);
                    }}
                  >
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => pantryMut.mute.mutate(item.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {items.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {summary.isRunning
            ? 'Nothing here yet — add what you need below.'
            : 'Nothing to buy — plan some recipes in this range first.'}
        </p>
      )}

      {sections.map((section) => (
        <section key={section.slug}>
          <h2 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
            {section.name}
          </h2>
          <ul className="divide-y rounded-lg border">
            {section.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                categories={categories}
                onSetCategory={(category) =>
                  setCategory.mutate({ itemId: item.id, canonicalId: item.canonicalId, category })
                }
                pricing={pricing.byItemId.get(item.id)}
                canAddPrice={!!pricing.storeId && !!item.canonicalId}
                onAddPrice={(priceCents, packageQuantity, packageUnit) =>
                  pricing.storeId && item.canonicalId
                    ? addPrice.mutate({
                        canonicalId: item.canonicalId,
                        storeId: pricing.storeId,
                        priceCents,
                        packageQuantity,
                        packageUnit,
                      })
                    : undefined
                }
                onToggle={(checked) => {
                  toggle.mutate({ itemId: item.id, checked });
                  applyToPantry.mutate({ item, checked });
                }}
                onSetActualCost={(cents) => setActual.mutate({ itemId: item.id, cents })}
                onOverride={(q, u) =>
                  edits.overrideQuantity.mutate({ itemId: item.id, totalQuantity: q, unit: u })
                }
                onDelete={() => edits.removeItem.mutate(item.id)}
                onSetConversion={(density) =>
                  item.canonicalId ? setConversion(item.canonicalId, density) : undefined
                }
              />
            ))}
          </ul>
        </section>
      ))}

      <AddItemForm
        onAdd={(name, q, u) => edits.addItem.mutateAsync({ name, quantity: q, unit: u })}
      />
    </main>
  );
}

function ItemRow({
  item,
  categories,
  pricing,
  canAddPrice,
  onAddPrice,
  onSetCategory,
  onToggle,
  onSetActualCost,
  onOverride,
  onDelete,
  onSetConversion,
}: {
  item: ShoppingItem;
  categories: ShoppingCategory[];
  pricing: ItemPricing | undefined;
  canAddPrice: boolean;
  onAddPrice: (priceCents: number, packageQuantity: number, packageUnit: string) => void;
  onSetCategory: (category: string) => void;
  onToggle: (checked: boolean) => void;
  onSetActualCost: (cents: number | null) => void;
  onOverride: (quantity: number | null, unit: string | null) => void;
  onDelete: () => void;
  onSetConversion: (density: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(item.totalQuantity?.toString() ?? '');
  const [unit, setUnit] = useState(item.unit ?? '');
  const [dismissed, setDismissed] = useState(false);
  const [density, setDensity] = useState('');
  const [pricingOpen, setPricingOpen] = useState(false);

  const quantityText = item.unresolved
    ? (item.subTotals ?? []).map((s) => `${trim(s.quantity)} ${s.unit}`).join(' + ')
    : item.totalQuantity != null
      ? `${trim(item.totalQuantity)} ${item.unit ?? ''}`
      : null;

  return (
    <li className="p-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={item.isChecked}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Check off ${item.displayName}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('font-medium', item.isChecked && 'text-muted-foreground line-through')}>
              {item.displayName}
            </span>
            {item.isManual && <Badge variant="secondary">added</Badge>}
            {!item.canonicalId && !item.adHocName && <Badge variant="outline">unmatched</Badge>}
            {item.unresolved && (
              <Badge variant="outline" className="text-amber-600">
                needs conversion
              </Badge>
            )}
          </div>

          {quantityText && <div className="text-sm">{quantityText}</div>}
          {item.pantryOffsetQuantity != null && (
            <div className="text-xs text-emerald-700">
              −{trim(item.pantryOffsetQuantity)} {item.unit ?? ''} already in your pantry
            </div>
          )}
          {item.purchase && (
            <div className="text-muted-foreground text-xs">
              buy {item.purchase.packages} × {trim(item.purchase.packageQuantity)}{' '}
              {item.purchase.packageUnit} = {trim(item.purchase.totalPurchaseQuantity)}{' '}
              {item.purchase.packageUnit}
            </div>
          )}
          {item.noQuantityCount > 0 && (
            <div className="text-muted-foreground text-xs">+{item.noQuantityCount} “to taste”</div>
          )}

          {/* Price — tap to record what you actually paid (check-off stays one tap). */}
          <ItemPrice
            estimatedCents={pricing?.estimatedCents ?? null}
            actualCents={item.actualCostCents}
            stale={pricing?.stale ?? false}
            onSet={onSetActualCost}
          />
          {canAddPrice && (!pricing?.hasPrice || pricing?.stale) && (
            <>
              {!pricingOpen ? (
                <button
                  type="button"
                  className="text-muted-foreground mt-0.5 block text-[11px] underline"
                  onClick={() => setPricingOpen(true)}
                >
                  {pricing?.hasPrice ? 'update estimate price' : 'set an estimate price'}
                </button>
              ) : (
                <AddPriceInline
                  defaultUnit={item.unit}
                  onSubmit={(c, q, u) => {
                    onAddPrice(c, q, u);
                    setPricingOpen(false);
                  }}
                  onCancel={() => setPricingOpen(false)}
                />
              )}
            </>
          )}

          {/* Unresolved-merge review */}
          {item.unresolved && !dismissed && item.canonicalId && (
            <div className="bg-muted/40 mt-2 space-y-2 rounded border p-2 text-xs">
              <p>Couldn’t combine these automatically.</p>
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Density for ${item.displayName}`}
                  inputMode="decimal"
                  placeholder="density g/ml"
                  value={density}
                  onChange={(e) => setDensity(e.target.value)}
                  className="h-8 w-32"
                />
                <Button
                  size="sm"
                  className="h-8"
                  disabled={density.trim() === ''}
                  onClick={() => onSetConversion(Number(density))}
                >
                  Set conversion
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setDismissed(true)}>
                  Keep separate
                </Button>
              </div>
            </div>
          )}

          {/* Manual quantity override + which aisle it belongs in */}
          {editing && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Quantity for ${item.displayName}`}
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="h-8 w-20"
                />
                <Input
                  aria-label={`Unit for ${item.displayName}`}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="h-8 w-20"
                />
                <Button
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    onOverride(qty.trim() === '' ? null : Number(qty), unit || null);
                    setEditing(false);
                  }}
                >
                  Save
                </Button>
              </div>
              <CategorySelect
                itemName={item.displayName}
                value={item.category}
                categories={categories}
                onChange={onSetCategory}
              />
            </div>
          )}

          <div className="mt-1 flex items-center gap-3 text-xs">
            {item.sources.length > 0 && (
              <button type="button" className="text-muted-foreground underline" onClick={() => setOpen((v) => !v)}>
                {open ? 'hide' : 'why?'} ({item.sources.length})
              </button>
            )}
            <button
              type="button"
              className="text-muted-foreground underline"
              onClick={() => setEditing((v) => !v)}
            >
              edit
            </button>
            <button type="button" className="text-destructive underline" onClick={onDelete}>
              remove
            </button>
          </div>

          {open && (
            <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
              {item.sources.map((s, i) => (
                <li key={i}>
                  {s.recipeTitle ?? 'a recipe'}
                  {s.contributedQuantity != null && ` — ${trim(s.contributedQuantity)}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * The item's price, shown as the actual paid (if recorded) or the estimate.
 * Tapping it opens a tiny inline field to record what was actually paid — one
 * optional tap, entirely separate from the one-tap check-off. Blank clears it
 * back to the estimate.
 */
function ItemPrice({
  estimatedCents,
  actualCents,
  stale,
  onSet,
}: {
  estimatedCents: number | null;
  actualCents: number | null;
  stale: boolean;
  onSet: (cents: number | null) => void;
}) {
  const effective = actualCents ?? estimatedCents;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  function begin() {
    setText(effective != null ? (effective / 100).toFixed(2) : '');
    setEditing(true);
  }
  function commit() {
    const t = text.trim();
    if (t === '') onSet(null);
    else {
      const dollars = Number(t);
      if (Number.isFinite(dollars) && dollars >= 0) onSet(Math.round(dollars * 100));
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mt-0.5 flex items-center gap-1">
        <span className="text-sm">$</span>
        <Input
          autoFocus
          inputMode="decimal"
          aria-label="Actual price paid"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-7 w-20"
        />
        <span className="text-muted-foreground text-[10px]">paid</span>
      </div>
    );
  }

  // No estimate and nothing recorded yet — still let the shopper record a price.
  if (effective == null) {
    return (
      <button
        type="button"
        onClick={begin}
        className="text-primary mt-0.5 text-xs underline"
        aria-label="Add price paid for this item"
      >
        add price
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={begin}
      className="mt-0.5 flex items-center gap-1.5 text-sm font-medium"
      aria-label={`Edit price paid for this item (currently ${formatCurrency(effective)})`}
    >
      <span
        className={cn(
          'underline decoration-dotted underline-offset-2',
          actualCents == null && 'text-muted-foreground',
        )}
      >
        {formatCurrency(effective)}
      </span>
      <span className="text-muted-foreground text-[10px] font-normal">
        {actualCents != null ? 'paid' : 'est'}
      </span>
      {stale && actualCents == null && (
        <Badge variant="outline" className="text-amber-600">
          stale
        </Badge>
      )}
    </button>
  );
}

function AddPriceInline({
  defaultUnit,
  onSubmit,
  onCancel,
}: {
  defaultUnit: string | null;
  onSubmit: (priceCents: number, packageQuantity: number, packageUnit: string) => void;
  onCancel: () => void;
}) {
  const [price, setPrice] = useState('');
  const [pkgQty, setPkgQty] = useState('');
  const [pkgUnit, setPkgUnit] = useState(defaultUnit ?? '');

  return (
    <div className="bg-muted/40 mt-2 flex flex-wrap items-center gap-2 rounded border p-2 text-xs">
      <span>$</span>
      <Input
        aria-label="Package price"
        inputMode="decimal"
        placeholder="2.50"
        className="h-8 w-20"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <span>for</span>
      <Input
        aria-label="Package quantity"
        inputMode="decimal"
        placeholder="8"
        className="h-8 w-16"
        value={pkgQty}
        onChange={(e) => setPkgQty(e.target.value)}
      />
      <Input
        aria-label="Package unit"
        placeholder="oz"
        className="h-8 w-16"
        value={pkgUnit}
        onChange={(e) => setPkgUnit(e.target.value)}
      />
      <Button
        size="sm"
        className="h-8"
        disabled={price.trim() === '' || pkgQty.trim() === '' || pkgUnit.trim() === ''}
        onClick={() => {
          const cents = Math.round(Number(price) * 100);
          const q = Number(pkgQty);
          if (Number.isFinite(cents) && Number.isFinite(q) && q > 0) {
            onSubmit(cents, q, pkgUnit.trim());
          }
        }}
      >
        Save price
      </Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function AddItemForm({
  onAdd,
}: {
  onAdd: (name: string, quantity: number | null, unit: string | null) => Promise<'added' | 'exists'>;
}) {
  const [picked, setPicked] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [typed, setTyped] = useState('');
  const [seed, setSeed] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [comboKey, setComboKey] = useState(0);
  const [busy, setBusy] = useState(false);
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
      setFeedback({ type: 'error', message: 'Type an item to add.' });
      return;
    }
    setBusy(true);
    try {
      const result = await onAdd(name, qty.trim() === '' ? null : Number(qty), unit || null);
      setFeedback({
        type: 'success',
        message: result === 'exists' ? `${name} is already on this list.` : `Added ${name}.`,
      });
      setPicked({ id: null, name: null });
      setTyped('');
      setSeed('');
      setQty('');
      setUnit('');
      setComboKey((k) => k + 1);
    } catch {
      setFeedback({ type: 'error', message: 'Couldn’t add that — please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-2 rounded-lg border p-3" onSubmit={submit}>
      <div className="flex flex-wrap items-end gap-2">
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
            placeholder="Add an item (e.g. paper towels)"
          />
        </div>
        <Input aria-label="Add item quantity" className="w-16" placeholder="qty" value={qty} onChange={(e) => setQty(e.target.value)} />
        <Input aria-label="Add item unit" className="w-16" placeholder="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
        <ScanButton size="default" onResult={onScanned} />
        <Button type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add'}
        </Button>
      </div>
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
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm">{children}</main>;
}
