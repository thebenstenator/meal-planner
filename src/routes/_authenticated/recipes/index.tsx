import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useDeletedRecipes,
  useRecipeList,
  useRestoreRecipe,
} from '@/features/recipes/use-recipes';
import { cn } from '@/lib/utils/cn';
import { MEAL_TYPES } from '@/schemas/recipe';

export const Route = createFileRoute('/_authenticated/recipes/')({
  component: RecipeLibrary,
});

function RecipeLibrary() {
  const [search, setSearch] = useState('');
  const [mealType, setMealType] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const { data, isLoading, isError } = useRecipeList(search, mealType);

  const recipes = data ?? [];

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recipes</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/recipes/import">Import</Link>
          </Button>
          <Button asChild>
            <Link to="/recipes/new">New recipe</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Input
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search recipes"
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip active={mealType === ''} onClick={() => setMealType('')}>
            all
          </FilterChip>
          {MEAL_TYPES.map((m) => (
            <FilterChip key={m} active={mealType === m} onClick={() => setMealType(m)}>
              {m}
            </FilterChip>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading recipes…</p>}
      {isError && <p className="text-destructive text-sm">Couldn’t load recipes.</p>}

      {data && recipes.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">No recipes yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add your family recipes — paste the ingredients and we’ll do the rest.
          </p>
          <Button asChild className="mt-4">
            <Link to="/recipes/new">Add your first recipe</Link>
          </Button>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link to="/recipes/$recipeId" params={{ recipeId: r.id }}>
              <Card className="hover:border-primary/50 h-full transition-colors">
                <CardHeader className="p-4">
                  <CardTitle className="text-base">{r.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-1.5 p-4 pt-0">
                  {r.mealTypes.map((m) => (
                    <Badge key={m} variant="secondary" className="capitalize">
                      {m}
                    </Badge>
                  ))}
                  <span className="text-muted-foreground text-xs">
                    {r.ingredientCount} ingredient{r.ingredientCount === 1 ? '' : 's'} ·{' '}
                    {r.servings} servings
                  </span>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <TrashSection open={showTrash} onToggle={() => setShowTrash((v) => !v)} />
    </main>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm capitalize',
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background',
      )}
    >
      {children}
    </button>
  );
}

function TrashSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { data } = useDeletedRecipes();
  const restore = useRestoreRecipe();
  const deleted = data ?? [];

  if (!open && deleted.length === 0) return null;

  return (
    <div className="border-t pt-4">
      <button type="button" onClick={onToggle} className="text-muted-foreground text-sm underline">
        {open ? 'Hide' : 'Show'} recently deleted ({deleted.length})
      </button>
      {open && (
        <ul className="mt-3 space-y-2">
          {deleted.length === 0 && (
            <li className="text-muted-foreground text-sm">Nothing deleted.</li>
          )}
          {deleted.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <span className="text-sm">{r.title}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => restore.mutate(r.id)}
                disabled={restore.isPending}
              >
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
