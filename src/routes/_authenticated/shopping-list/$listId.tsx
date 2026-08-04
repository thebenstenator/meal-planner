import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ShoppingItem } from '@/features/shopping-list/api';
import {
  useGenerateList,
  useShoppingList,
  useToggleItem,
} from '@/features/shopping-list/use-shopping-list';
import { cn } from '@/lib/utils/cn';

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
  const regenerate = useGenerateList();

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

  async function onRegenerate() {
    if (!summary.dateRangeStart || !summary.dateRangeEnd) return;
    await regenerate.mutateAsync({
      name: summary.name,
      start: summary.dateRangeStart,
      end: summary.dateRangeEnd,
      listId, // preserves check-off
    });
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
                onToggle={(checked) => toggle.mutate({ itemId: item.id, checked })}
              />
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

function ItemRow({ item, onToggle }: { item: ShoppingItem; onToggle: (checked: boolean) => void }) {
  const [open, setOpen] = useState(false);

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
            {!item.canonicalId && <Badge variant="outline">unmatched</Badge>}
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
            <div className="text-muted-foreground text-xs">
              +{item.noQuantityCount} “to taste”
            </div>
          )}

          {item.sources.length > 0 && (
            <button
              type="button"
              className="text-muted-foreground mt-1 text-xs underline"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'hide' : 'why?'} ({item.sources.length})
            </button>
          )}
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

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm">{children}</main>;
}
