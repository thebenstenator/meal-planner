// "Add to shopping list" from a recipe: work out what the recipe needs that
// isn't already in the pantry, then let the cook tick off anything they've
// actually got (which stocks the pantry) before dropping the rest onto a list.

import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { RecipeIngredientDraft } from '@/features/recipes/api';
import { useAddCanonicalToPantry } from '@/features/pantry/use-pantry';
import type { ListItemInput } from '@/features/shopping-list/api';
import { useAddItemsToList, useRecipeNeededItems, useShoppingLists } from '@/features/shopping-list/use-shopping-list';

function trim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

export function AddToListDialog({
  recipe,
  targetServings,
  onClose,
}: {
  recipe: { id: string; ingredients: RecipeIngredientDraft[]; servings: number };
  /** Servings the cook has the recipe scaled to — the amounts follow it. */
  targetServings: number;
  onClose: () => void;
}) {
  const { data: lists } = useShoppingLists();
  const addToPantry = useAddCanonicalToPantry();
  const addItems = useAddItemsToList();

  const ingredientInputs = useMemo(
    () =>
      recipe.ingredients.map((ing) => ({
        id: ing.id ?? null,
        quantity: ing.quantity,
        unit: ing.unit,
        canonicalId: ing.canonicalId,
        rawText: ing.rawText,
      })),
    [recipe.ingredients],
  );

  const { data: items, isLoading, isError } = useRecipeNeededItems(
    recipe.id,
    ingredientInputs,
    recipe.servings,
    targetServings,
    true,
  );

  // Items the cook says they already have (unchecked). Everything starts
  // checked — the common case is "buy all of this".
  const [have, setHave] = useState<Set<number>>(new Set());
  // null = not chosen yet; fall back to the first list, or '' (→ running list).
  const [target, setTarget] = useState<string | null>(null);
  const [result, setResult] = useState<{ listId: string; added: number; stocked: number } | null>(
    null,
  );

  const allLists = lists ?? [];
  const effectiveTarget = target ?? allLists[0]?.id ?? '';

  const needed = items ?? [];
  const toBuy = needed.filter((_, i) => !have.has(i));
  // Only pantry-matched items can be stocked; an unchecked unmatched line is
  // simply dropped from the list.
  const toStock = needed.filter((it, i) => have.has(i) && it.canonical_ingredient_id);
  const busy = addItems.isPending || addToPantry.isPending;

  function toggle(index: number, checked: boolean) {
    setHave((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function confirm() {
    const listAdds: ListItemInput[] = toBuy.map((it) => ({
      canonicalId: it.canonical_ingredient_id,
      name: it.display_name,
      quantity: it.total_quantity,
      unit: it.unit,
      category: it.category,
    }));
    const pantryAdds = toStock.map((it) => ({
      canonicalId: it.canonical_ingredient_id as string,
      quantity: it.total_quantity,
      unit: it.unit,
    }));

    // Stock the "already have" items first (best-effort — never blocks the add).
    await addToPantry.mutateAsync(pantryAdds).catch(() => undefined);
    const { listId } = await addItems.mutateAsync({
      listId: effectiveTarget || null,
      items: listAdds,
    });
    setResult({ listId, added: listAdds.length, stocked: pantryAdds.length });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="bg-background w-full max-w-md rounded-lg border shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">Add to shopping list</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-4 p-5">
          {result ? (
            <Done result={result} onClose={onClose} />
          ) : isLoading ? (
            <p className="text-muted-foreground text-sm">Checking your pantry…</p>
          ) : isError ? (
            <p className="text-destructive text-sm">Couldn’t check your pantry. Try again.</p>
          ) : needed.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm">You’ve already got everything for this recipe. 🎉</p>
              <Button onClick={onClose} className="w-full">
                Done
              </Button>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                These aren’t in your pantry. Uncheck anything you already have — we’ll add it to
                your pantry instead of the list.
              </p>

              <ul className="divide-y rounded-lg border">
                {needed.map((item, i) => {
                  const checked = !have.has(i);
                  const qty =
                    item.total_quantity != null
                      ? `${trim(item.total_quantity)} ${item.unit ?? ''}`.trim()
                      : null;
                  const matched = !!item.canonical_ingredient_id;
                  return (
                    <li key={`${item.display_name}-${i}`} className="flex items-center gap-3 p-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggle(i, e.target.checked)}
                        aria-label={`Add ${item.display_name} to the list`}
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        {item.display_name}
                        {qty && <span className="text-muted-foreground"> · {qty}</span>}
                      </span>
                      {!checked && (
                        <span className="shrink-0 text-xs text-emerald-700">
                          {matched ? 'have it → pantry' : 'skip'}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              {allLists.length > 1 && (
                <div className="space-y-1.5">
                  <Label htmlFor="add-target">Add to</Label>
                  <select
                    id="add-target"
                    value={effectiveTarget}
                    onChange={(e) => setTarget(e.target.value)}
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  >
                    {allLists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {allLists.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  We’ll start your first list (“Things we need”).
                </p>
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                  {toBuy.length} to add
                  {toStock.length > 0 && <> · {toStock.length} to pantry</>}
                </span>
                <Button onClick={confirm} disabled={busy || (toBuy.length === 0 && toStock.length === 0)}>
                  {busy
                    ? 'Adding…'
                    : toBuy.length > 0
                      ? `Add ${toBuy.length} to list`
                      : 'Update pantry'}
                </Button>
              </div>
              {addItems.isError && (
                <p className="text-destructive text-sm">Couldn’t add to the list. Try again.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Done({
  result,
  onClose,
}: {
  result: { listId: string; added: number; stocked: number };
  onClose: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
        {result.added > 0
          ? `Added ${result.added} item${result.added === 1 ? '' : 's'} to your list.`
          : 'Nothing to add — everything was already on hand.'}
        {result.stocked > 0 &&
          ` Stocked ${result.stocked} in your pantry.`}
      </p>
      <div className="flex items-center gap-2">
        <Button asChild>
          <Link to="/shopping-list/$listId" params={{ listId: result.listId }} onClick={onClose}>
            View list
          </Link>
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
