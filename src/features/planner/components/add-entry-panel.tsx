import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRecipeList } from '@/features/recipes/use-recipes';
import { useCreatePlanEntry } from '@/features/planner/use-planner';
import { cn } from '@/lib/utils/cn';
import { PLAN_KINDS, PLAN_KIND_LABELS, type PlanKind, type Slot } from '@/schemas/plan';

interface Props {
  date: string;
  slot: Slot;
  onClose: () => void;
}

/** Inline flow to add a plan entry of any kind to a given day + slot. */
export function AddEntryPanel({ date, slot, onClose }: Props) {
  const create = useCreatePlanEntry();
  const [kind, setKind] = useState<PlanKind>('recipe');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [servings, setServings] = useState('');
  const [note, setNote] = useState('');
  const { data: recipes } = useRecipeList(recipeSearch, '');

  async function addRecipe(recipeId: string) {
    const override = servings.trim() === '' ? null : Number(servings);
    await create.mutateAsync({
      date,
      slot,
      kind: 'recipe',
      recipeId,
      note: null,
      servingsOverride: override && override > 0 ? override : null,
    });
    onClose();
  }

  async function addNonRecipe() {
    await create.mutateAsync({
      date,
      slot,
      kind,
      recipeId: null,
      note: kind === 'note' ? note.trim() || null : null,
      servingsOverride: null,
    });
    onClose();
  }

  return (
    <div className="bg-muted/40 mt-2 space-y-2 rounded-md border p-2" data-testid="add-entry-panel">
      <div className="flex flex-wrap gap-1">
        {PLAN_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-xs',
              kind === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-background',
            )}
          >
            {PLAN_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {kind === 'recipe' && (
        <div className="space-y-1">
          <div className="flex gap-1">
            <Input
              aria-label="Search recipes to add"
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              placeholder="Search recipes…"
              className="h-9 flex-1"
            />
            <Input
              aria-label="Servings for this meal"
              inputMode="numeric"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              placeholder="serv."
              title="Servings (optional) — leave blank for the recipe default"
              className="h-9 w-16"
            />
          </div>
          <ul className="max-h-40 overflow-auto">
            {(recipes ?? []).slice(0, 8).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="hover:bg-accent w-full rounded px-2 py-1 text-left text-sm"
                  onClick={() => addRecipe(r.id)}
                  disabled={create.isPending}
                >
                  {r.title}
                </button>
              </li>
            ))}
            {recipes && recipes.length === 0 && (
              <li className="text-muted-foreground px-2 py-1 text-xs">
                No recipes — add one first.
              </li>
            )}
          </ul>
        </div>
      )}

      {kind === 'note' && (
        <Input
          aria-label="Note text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. potluck at the Smiths"
          className="h-9"
        />
      )}

      {kind !== 'recipe' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={addNonRecipe} disabled={create.isPending}>
            Add {PLAN_KIND_LABELS[kind].toLowerCase()}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      )}

      {kind === 'recipe' && (
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      )}
    </div>
  );
}
