import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RowMenu } from '@/components/ui/row-menu';
import { CanonicalCombobox } from '@/features/ingredients/components/canonical-combobox';
import { PantryTrackLine } from '@/features/pantry/components/pantry-track-line';
import { shouldTrackInPantry } from '@/features/pantry/track-decision';
import {
  useApplyPurchaseToPantry,
  usePantryPrefs,
  useSetPantryTracked,
} from '@/features/pantry/use-pantry';
import { fromISO, weekRange } from '@/features/planner/dates';
import { ScanButton } from '@/features/scanner/scan-button';
import type { ShoppingItem, ShoppingListSummary } from '@/features/shopping-list/api';
import { groupByCategory, type ShoppingCategory } from '@/features/shopping-list/categories';
import { CategorySelect } from '@/features/shopping-list/components/category-select';
import { isOwnClickTarget } from '@/features/shopping-list/row-toggle';
import { useShoppingCategories } from '@/features/shopping-list/use-categories';
import {
  useAddToRunningList,
  useCreateList,
  useDeleteShoppingList,
  useGenerateList,
  useItemEdits,
  useRenameList,
  useSetItemCategory,
  useShoppingList,
  useShoppingLists,
  useToggleItem,
} from '@/features/shopping-list/use-shopping-list';
import { cn } from '@/lib/utils/cn';

export const Route = createFileRoute('/_authenticated/shopping-list/')({
  component: ShoppingListsPage,
});

function trim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

function ShoppingListsPage() {
  const navigate = useNavigate();
  const { data: lists } = useShoppingLists();
  const create = useCreateList();

  const [picked, setPicked] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [addingList, setAddingList] = useState(false);
  const [newName, setNewName] = useState('');

  const allLists = lists ?? [];
  // The active tab: the user's pick if it still exists, else the first list.
  const activeId =
    (picked && allLists.some((l) => l.id === picked) ? picked : allLists[0]?.id) ?? null;
  const active = allLists.find((l) => l.id === activeId) ?? null;

  async function submitNewList(e: React.FormEvent) {
    e.preventDefault();
    if (newName.trim() === '') return;
    const id = await create.mutateAsync({ name: newName });
    setPicked(id);
    setNewName('');
    setAddingList(false);
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Shopping list</h1>
        <Button onClick={() => setGenerating(true)}>Generate a list</Button>
      </div>

      {/* Tabs: one per list (store). Switch between them; add a new one. */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Your lists">
        {allLists.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={l.id === activeId}
            onClick={() => setPicked(l.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              l.id === activeId
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-accent',
            )}
          >
            {l.name}
          </button>
        ))}

        {addingList ? (
          <form onSubmit={submitNewList} className="flex items-center gap-1.5">
            <Input
              autoFocus
              aria-label="New list name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Store or list name"
              className="h-8 w-40"
            />
            <Button
              type="submit"
              size="sm"
              className="h-8"
              aria-label="Create list"
              disabled={create.isPending}
            >
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => {
                setAddingList(false);
                setNewName('');
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAddingList(true)}
            className="text-muted-foreground hover:bg-accent rounded-full border border-dashed px-3 py-1 text-sm"
          >
            + New list
          </button>
        )}
      </div>

      {activeId && active ? (
        <ListPanel key={activeId} listId={activeId} summary={active} onDeleted={() => setPicked(null)} />
      ) : (
        <EmptyList onCreated={(id) => setPicked(id)} />
      )}

      {generating && (
        <GenerateModal
          lists={allLists}
          defaultTarget={activeId}
          onClose={() => setGenerating(false)}
          onDone={(id) => {
            setGenerating(false);
            void navigate({ to: '/shopping-list/$listId', params: { listId: id } });
          }}
        />
      )}
    </main>
  );
}

/**
 * No lists yet: a single quick-add that creates the household's first list on the
 * first item (the standing "Things we need" list), then it becomes a tab.
 */
function EmptyList({ onCreated }: { onCreated: (id: string) => void }) {
  const add = useAddToRunningList();
  const [typed, setTyped] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = typed.trim();
    if (name === '') return;
    try {
      const { listId } = await add.mutateAsync({ name, quantity: null, unit: null });
      setTyped('');
      setFeedback(null);
      onCreated(listId);
    } catch {
      setFeedback('Couldn’t add that — please try again.');
    }
  }

  return (
    <section className="space-y-2">
      <p className="text-muted-foreground text-sm">
        Add something you need and we’ll start your first list. Make more lists (one per store) with
        “New list”.
      </p>
      <form onSubmit={submit} className="flex items-start gap-2">
        <Input
          aria-label="Add something you need"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Add something you need…"
        />
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? 'Adding…' : 'Add'}
        </Button>
      </form>
      {feedback && <p className="text-destructive text-sm">{feedback}</p>}
    </section>
  );
}

/**
 * The selected list, inline: rename/delete, a quick-add (matched to a real
 * ingredient), and the checkable items. The full priced view (categories, prices,
 * "why?", regenerate) lives on the detail page.
 */
function ListPanel({
  listId,
  summary,
  onDeleted,
}: {
  listId: string;
  summary: ShoppingListSummary;
  onDeleted: () => void;
}) {
  const { data } = useShoppingList(listId);
  const toggle = useToggleItem(listId);
  const edits = useItemEdits(listId);
  const rename = useRenameList();
  const del = useDeleteShoppingList();
  const applyToPantry = useApplyPurchaseToPantry();
  const { data: pantryPrefs } = usePantryPrefs();
  const setPantryTracked = useSetPantryTracked();
  const setCategory = useSetItemCategory(listId);
  const { categories } = useShoppingCategories();

  const [picked, setPicked] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const [typed, setTyped] = useState('');
  const [seed, setSeed] = useState('');
  const [comboKey, setComboKey] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(summary.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const items = data?.items ?? [];
  // Same store sections as the full list, so the aisle order carries over.
  const sections = groupByCategory(items, categories);

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
      setFeedback({ type: 'error', message: 'Type something you need (e.g. “dish soap”).' });
      return;
    }
    try {
      const result = await edits.addItem.mutateAsync({ name, quantity: null, unit: null });
      setFeedback({
        type: 'success',
        message: result === 'exists' ? `${name} is already on this list.` : `Added ${name}.`,
      });
      setPicked({ id: null, name: null });
      setTyped('');
      setSeed('');
      setComboKey((k) => k + 1);
    } catch {
      setFeedback({ type: 'error', message: 'Couldn’t add that — please try again.' });
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {renaming ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              rename.mutate({ listId, name: nameDraft });
              setRenaming(false);
            }}
          >
            <Input
              autoFocus
              aria-label="List name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="h-8 w-48"
            />
            <Button type="submit" size="sm" className="h-8">
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => {
                setRenaming(false);
                setNameDraft(summary.name);
              }}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <h2 className="text-lg font-semibold">{summary.name}</h2>
        )}
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {!renaming && (
            <button
              type="button"
              className="text-muted-foreground underline"
              onClick={() => {
                setNameDraft(summary.name);
                setRenaming(true);
              }}
            >
              rename
            </button>
          )}
          <Link
            to="/shopping-list/$listId"
            params={{ listId }}
            className="text-muted-foreground underline"
          >
            open full list →
          </Link>
        </div>
      </div>

      <form onSubmit={submit} className="flex items-start gap-2">
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
            placeholder="Add something you need…"
          />
        </div>
        <ScanButton size="default" onResult={(p) => onScanned(p.name)} />
        <Button type="submit" disabled={edits.addItem.isPending}>
          {edits.addItem.isPending ? 'Adding…' : 'Add'}
        </Button>
      </form>
      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className={feedback.type === 'success' ? 'text-sm text-emerald-700' : 'text-destructive text-sm'}
        >
          {feedback.message}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing on this list yet.</p>
      ) : (
        sections.map((section) => (
          <div key={section.slug} className="space-y-1">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
              {section.name}
            </h3>
            <ul className="divide-y rounded-lg border">
              {section.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  categories={categories}
                  onToggle={(checked) => {
                    toggle.mutate({ itemId: item.id, checked });
                    applyToPantry.mutate({ item, checked });
                  }}
                  onSetCategory={(category) =>
                    setCategory.mutate({
                      itemId: item.id,
                      canonicalId: item.canonicalId,
                      category,
                    })
                  }
                  pantryTracked={shouldTrackInPantry(item, pantryPrefs ?? new Map())}
                  onSetPantryTracked={(tracked) => setPantryTracked.mutate({ item, tracked })}
                  onRemove={() => edits.removeItem.mutate(item.id)}
                />
              ))}
            </ul>
          </div>
        ))
      )}

      <div className="pt-1">
        {!confirmDelete ? (
          <button
            type="button"
            className="text-muted-foreground text-xs underline"
            onClick={() => setConfirmDelete(true)}
          >
            Delete this list
          </button>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span>Delete “{summary.name}”?</span>
            <Button
              variant="destructive"
              size="sm"
              className="h-7"
              disabled={del.isPending}
              onClick={async () => {
                await del.mutateAsync(listId);
                setConfirmDelete(false);
                onDeleted();
              }}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * One line on the list: check it off, or reach the row's actions behind "⋮".
 * Changing the category reveals the picker underneath rather than opening a
 * dialog — you're usually re-filing several items in a row while standing in
 * the store, and a dialog per item would be miserable.
 */
function ItemRow({
  item,
  categories,
  onToggle,
  onSetCategory,
  pantryTracked,
  onSetPantryTracked,
  onRemove,
}: {
  item: ShoppingItem;
  categories: ShoppingCategory[];
  onToggle: (checked: boolean) => void;
  onSetCategory: (category: string) => void;
  /** Whether checking this off adds it to the pantry (pref, else the heuristic). */
  pantryTracked: boolean;
  onSetPantryTracked: (tracked: boolean) => void;
  onRemove: () => void;
}) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const quantityText =
    item.totalQuantity != null ? `${trim(item.totalQuantity)} ${item.unit ?? ''}`.trim() : null;

  return (
    // Tap anywhere on the row to check it off. The checkbox stays the accessible
    // control (and the keyboard one); this just widens the target for a thumb.
    <li
      className="cursor-pointer p-3"
      onClick={(e) => {
        if (!isOwnClickTarget(e.target)) onToggle(!item.isChecked);
      }}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={item.isChecked}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Check off ${item.displayName}`}
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-sm',
            item.isChecked && 'text-muted-foreground line-through',
          )}
        >
          {item.displayName}
          {quantityText && <span className="text-muted-foreground"> · {quantityText}</span>}
        </span>
        <RowMenu
          label={`Actions for ${item.displayName}`}
          actions={[
            { label: 'Change category', onSelect: () => setCategoryOpen((v) => !v) },
            { label: 'Remove', onSelect: onRemove, destructive: true },
          ]}
        />
      </div>

      {/* Aligned under the name, clear of the checkbox. */}
      <div className="pl-7">
        <PantryTrackLine item={item} tracked={pantryTracked} onSetTracked={onSetPantryTracked} />
      </div>

      {categoryOpen && (
        <div data-no-toggle>
          <CategorySelect
            itemName={item.displayName}
            value={item.category}
            categories={categories}
            onChange={(slug) => {
              onSetCategory(slug);
              setCategoryOpen(false);
            }}
          />
        </div>
      )}
    </li>
  );
}

/**
 * Generate the meal plan for a date range into a chosen list — a new one, or an
 * existing store tab (its jotted items are kept; only the plan items refresh).
 */
function GenerateModal({
  lists,
  defaultTarget,
  onClose,
  onDone,
}: {
  lists: ShoppingListSummary[];
  defaultTarget: string | null;
  onClose: () => void;
  onDone: (listId: string) => void;
}) {
  const week = weekRange(new Date());
  const [start, setStart] = useState(week.start);
  const [end, setEnd] = useState(week.end);
  const [name, setName] = useState(`Week of ${format(fromISO(week.start), 'MMM d')}`);
  const [subtractPantry, setSubtractPantry] = useState(true);
  // '' = create a new list; otherwise an existing list id.
  const [target, setTarget] = useState<string>(defaultTarget ?? '');
  const generate = useGenerateList();

  const targetList = lists.find((l) => l.id === target);

  async function onGenerate() {
    const id = await generate.mutateAsync(
      target === ''
        ? { name, start, end, subtractPantry }
        : { name: targetList?.name ?? name, start, end, listId: target, subtractPantry },
    );
    onDone(id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="bg-background w-full max-w-md rounded-lg border shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">Generate a list</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-muted-foreground text-sm">
            Adds your meal plan for these dates to the list you pick. Items already jotted on that
            list are kept.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="target">Add to</Label>
            <select
              id="target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">New list…</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {target === '' && (
            <div className="space-y-1.5">
              <Label htmlFor="name">New list name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">From</Label>
              <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">To</Label>
              <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={subtractPantry}
              onChange={(e) => setSubtractPantry(e.target.checked)}
            />
            Subtract what’s already in my pantry
          </label>
          {generate.isError && (
            <p className="text-destructive text-sm">Couldn’t generate. Try again.</p>
          )}
          <Button onClick={onGenerate} disabled={generate.isPending} className="w-full">
            {generate.isPending ? 'Generating…' : 'Generate list'}
          </Button>
        </div>
      </div>
    </div>
  );
}
