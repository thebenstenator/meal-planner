import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ShoppingCategory } from '@/features/shopping-list/categories';
import { useCategoryEdits } from '@/features/shopping-list/use-categories';

const NEW_CATEGORY = '__new__';

/**
 * File one item under a category — and create a category on the spot when none
 * of them fit ("Baby", "Bulk bins"). New categories go to the end of the aisle
 * order; reorder them under "Categories".
 */
export function CategorySelect({
  itemName,
  value,
  categories,
  onChange,
}: {
  itemName: string;
  value: string | null;
  categories: ShoppingCategory[];
  onChange: (slug: string) => void;
}) {
  const edits = useCategoryEdits(categories);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const known = categories.some((c) => c.slug === value);
  const selected = known
    ? (value as string)
    : (categories.find((c) => c.isFallback)?.slug ?? '');

  async function createAndAssign() {
    const name = draft.trim();
    if (name === '') return;
    try {
      const category = await edits.add.mutateAsync({ name });
      onChange(category.slug);
      setDraft('');
      setCreating(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t add that category.');
    }
  }

  if (creating) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <Input
          autoFocus
          aria-label={`New category for ${itemName}`}
          placeholder="Category name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void createAndAssign();
            }
            if (e.key === 'Escape') setCreating(false);
          }}
          className="h-8 w-40"
        />
        <Button
          size="sm"
          className="h-8"
          disabled={draft.trim() === '' || edits.add.isPending}
          onClick={() => void createAndAssign()}
        >
          Add
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          onClick={() => {
            setCreating(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
        {error && <span className="text-destructive text-xs">{error}</span>}
      </div>
    );
  }

  return (
    <select
      aria-label={`Category for ${itemName}`}
      value={selected}
      onChange={(e) => {
        if (e.target.value === NEW_CATEGORY) {
          setCreating(true);
          return;
        }
        onChange(e.target.value);
      }}
      className="border-input bg-background text-muted-foreground mt-1 h-8 rounded-md border px-2 text-xs"
    >
      {categories.map((c) => (
        <option key={c.id} value={c.slug}>
          {c.name}
        </option>
      ))}
      <option value={NEW_CATEGORY}>+ New category…</option>
    </select>
  );
}
