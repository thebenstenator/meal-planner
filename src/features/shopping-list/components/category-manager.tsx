import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ShoppingCategory } from '@/features/shopping-list/categories';
import { useCategoryEdits } from '@/features/shopping-list/use-categories';

/**
 * The household's store sections: rename them, put them in the order you
 * actually walk the store, add your own, remove the ones you don't use.
 * "Other" is the bucket everything else falls into, so it stays put.
 */
export function CategoryManager({
  categories,
  onClose,
}: {
  categories: ShoppingCategory[];
  onClose: () => void;
}) {
  const edits = useCategoryEdits(categories);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const movable = categories.filter((c) => !c.isFallback);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (newName.trim() === '') return;
    try {
      await edits.add.mutateAsync({ name: newName });
      setNewName('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t add that category.');
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-3" aria-label="Shopping categories">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-medium">Categories</h2>
          <p className="text-muted-foreground text-xs">
            Sections your lists are grouped by, in the order you shop them.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>

      <ul className="divide-y rounded-md border">
        {categories.map((category) => {
          const isFirstMovable = category.id === movable[0]?.id;
          const isLastMovable = category.id === movable[movable.length - 1]?.id;
          return (
            <li key={category.id} className="flex items-center gap-2 p-2">
              {editingId === category.id ? (
                <form
                  className="flex flex-1 items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    edits.rename.mutate({ id: category.id, name: draft });
                    setEditingId(null);
                  }}
                >
                  <Input
                    autoFocus
                    aria-label={`Rename ${category.name}`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="h-8 flex-1"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8"
                    disabled={draft.trim() === ''}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
                  {!category.isFallback && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        aria-label={`Move ${category.name} up`}
                        disabled={isFirstMovable}
                        onClick={() =>
                          edits.move.mutate({ id: category.id, direction: 'up' })
                        }
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        aria-label={`Move ${category.name} down`}
                        disabled={isLastMovable}
                        onClick={() =>
                          edits.move.mutate({ id: category.id, direction: 'down' })
                        }
                      >
                        ↓
                      </Button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="text-muted-foreground shrink-0 text-xs underline"
                    onClick={() => {
                      setDraft(category.name);
                      setEditingId(category.id);
                    }}
                  >
                    rename
                  </button>
                  {!category.isFallback &&
                    (confirmId === category.id ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs">
                        <button
                          type="button"
                          className="text-destructive underline"
                          onClick={() => {
                            edits.remove.mutate(category.id);
                            setConfirmId(null);
                          }}
                        >
                          delete, move items to Other
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground underline"
                          onClick={() => setConfirmId(null)}
                        >
                          cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-destructive shrink-0 text-xs underline"
                        onClick={() => setConfirmId(category.id)}
                      >
                        delete
                      </button>
                    ))}
                </>
              )}
            </li>
          );
        })}
      </ul>

      <form className="flex items-center gap-2" onSubmit={add}>
        <Input
          aria-label="New category name"
          placeholder="Add a category (e.g. Bulk bins)"
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setError(null);
          }}
          className="h-9"
        />
        <Button type="submit" className="h-9 shrink-0" disabled={edits.add.isPending}>
          Add
        </Button>
      </form>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {edits.remove.isError && (
        <p className="text-destructive text-sm">Couldn’t delete that category.</p>
      )}
    </section>
  );
}
