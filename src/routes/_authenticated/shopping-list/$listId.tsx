import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAddPrice } from '@/features/pricing/use-pricing';
import { useListPricing, type ItemPricing } from '@/features/pricing/use-list-pricing';
import type { ShoppingItem } from '@/features/shopping-list/api';
import {
  useGenerateList,
  useItemEdits,
  useSetConversion,
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
  const pricing = useListPricing(data?.items ?? []);

  if (isLoading) return <Centered>Loading…</Centered>;
  if (isError || !data) return <Centered>Couldn’t load this list.</Centered>;

  const { summary, items } = data;
  const byCategory = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const cat = item.category ?? 'other';
    const bucket = byCategory.get(cat) ?? [];
    bucket.push(item);
    byCategory.set(cat, bucket);
  }

  // What's been bought so far: purchase cost of checked-off items.
  const checkedCents = items.reduce(
    (sum, it) => (it.isChecked ? sum + (pricing.byItemId.get(it.id)?.estimatedCents ?? 0) : sum),
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
            {summary.dateRangeStart} → {summary.dateRangeEnd} · {items.length} items
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={regenerate.isPending}>
          {regenerate.isPending ? 'Regenerating…' : 'Regenerate'}
        </Button>
      </div>

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

      {items.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Nothing to buy — plan some recipes in this range first.
        </p>
      )}

      {[...byCategory.entries()].sort().map(([cat, catItems]) => (
        <section key={cat}>
          <h2 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
            {cat}
          </h2>
          <ul className="divide-y rounded-lg border">
            {catItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
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
                onToggle={(checked) => toggle.mutate({ itemId: item.id, checked })}
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

      <AddItemForm onAdd={(name, q, u) => edits.addItem.mutate({ name, quantity: q, unit: u })} />
    </main>
  );
}

function ItemRow({
  item,
  pricing,
  canAddPrice,
  onAddPrice,
  onToggle,
  onOverride,
  onDelete,
  onSetConversion,
}: {
  item: ShoppingItem;
  pricing: ItemPricing | undefined;
  canAddPrice: boolean;
  onAddPrice: (priceCents: number, packageQuantity: number, packageUnit: string) => void;
  onToggle: (checked: boolean) => void;
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

          {/* Price */}
          {pricing?.estimatedCents != null && (
            <div className="text-sm font-medium">
              {formatCurrency(pricing.estimatedCents)}
              {pricing.stale && (
                <Badge variant="outline" className="ml-2 text-amber-600">
                  stale
                </Badge>
              )}
            </div>
          )}
          {canAddPrice && (!pricing?.hasPrice || pricing?.stale) && (
            <>
              {!pricingOpen ? (
                <button
                  type="button"
                  className="text-primary mt-1 text-xs underline"
                  onClick={() => setPricingOpen(true)}
                >
                  {pricing?.hasPrice ? 'update price' : 'no price yet — add one'}
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

          {/* Manual quantity override */}
          {editing && (
            <div className="mt-2 flex items-center gap-2">
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
  onAdd: (name: string, quantity: number | null, unit: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');

  return (
    <form
      className="flex items-end gap-2 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() === '') return;
        onAdd(name.trim(), qty.trim() === '' ? null : Number(qty), unit || null);
        setName('');
        setQty('');
        setUnit('');
      }}
    >
      <div className="flex-1">
        <Input
          aria-label="Add item name"
          placeholder="Add an item (e.g. paper towels)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <Input aria-label="Add item quantity" className="w-16" placeholder="qty" value={qty} onChange={(e) => setQty(e.target.value)} />
      <Input aria-label="Add item unit" className="w-16" placeholder="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
      <Button type="submit">Add</Button>
    </form>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm">{children}</main>;
}
