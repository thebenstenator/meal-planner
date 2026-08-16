import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { AddMenu } from '@/components/add-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { matchesScope, scopeCounts, scopeKey, type RecipeScope } from '@/features/recipes/scope';
import { usePools } from '@/features/recipes/use-pool';
import {
  useCategorizeUncategorized,
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
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [mealType, setMealType] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [scope, setScope] = useState<RecipeScope>({ kind: 'all' });
  const { data, isLoading, isError } = useRecipeList(search, mealType);
  const { data: pools } = usePools();

  const recipes = data ?? [];
  const myPools = pools ?? [];
  // Leaving a pool (or having it deleted) shouldn't strand you on a dead tab.
  const active: RecipeScope =
    scope.kind === 'pool' && !myPools.some((p) => p.id === scope.poolId) ? { kind: 'all' } : scope;
  const activeKey = scopeKey(active);
  const counts = scopeCounts(recipes, myPools.map((p) => p.id));

  const visible = recipes.filter((r) => matchesScope(r, active));
  // What the "all" tab would add — the escape hatch when you're searching inside
  // one place and the thing you want lives somewhere else.
  const elsewhere = recipes.length - visible.length;
  const activePoolName =
    active.kind === 'pool' ? (myPools.find((p) => p.id === active.poolId)?.name ?? 'this pool') : '';

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recipes</h1>
        <AddMenu
          label="Add recipe"
          methods={[
            {
              label: 'Enter manually',
              description: 'Type in a recipe yourself',
              onSelect: () => void navigate({ to: '/recipes/new' }),
            },
            {
              label: 'From photo, link, or PDF',
              description: 'We read it and let you review',
              onSelect: () => void navigate({ to: '/recipes/import' }),
            },
            {
              label: 'Bulk paste or files',
              description: 'Add several at once from text or files',
              onSelect: () => void navigate({ to: '/recipes/bulk-import' }),
            },
          ]}
        />
      </div>

      {/* Tabs: where a recipe lives. Only worth showing once there's more than
          one place — with no pools, "all" and "my household" are the same set.
          Pool management (invites, members, share-back) lives on its own page. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {myPools.length > 0 ? (
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="tablist"
            aria-label="Where recipes live"
          >
            <ScopeTab
              active={activeKey === 'all'}
              count={counts.all}
              onClick={() => setScope({ kind: 'all' })}
            >
              All
            </ScopeTab>
            <ScopeTab
              active={activeKey === 'household'}
              count={counts.household}
              onClick={() => setScope({ kind: 'household' })}
            >
              My household
            </ScopeTab>
            {myPools.map((p) => (
              <ScopeTab
                key={p.id}
                active={activeKey === `pool:${p.id}`}
                count={counts.pools[p.id] ?? 0}
                onClick={() => setScope({ kind: 'pool', poolId: p.id })}
              >
                {p.name}
              </ScopeTab>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Share recipes with family in a pool.</p>
        )}
        <Link
          to="/recipes/pools"
          className="text-muted-foreground shrink-0 text-sm underline"
        >
          {myPools.length > 0 ? 'Manage pools' : 'Get started →'}
        </Link>
      </div>

      <div className="space-y-3">
        <Input
          placeholder={
            active.kind === 'pool'
              ? `Search ${activePoolName}…`
              : active.kind === 'household'
                ? 'Search your recipes…'
                : 'Search recipes…'
          }
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

      {/* Only our own recipes can be categorized — pool recipes belong to the
          household that added them. */}
      <CategorizeBanner
        uncategorized={recipes.filter((r) => r.ownedByMe && r.mealTypes.length === 0).length}
      />

      {isLoading && <p className="text-muted-foreground text-sm">Loading recipes…</p>}
      {isError && <p className="text-destructive text-sm">Couldn’t load recipes.</p>}

      {data && visible.length === 0 && active.kind === 'all' && (
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

      {data && visible.length === 0 && active.kind !== 'all' && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">Nothing here</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {active.kind === 'household'
              ? 'None of your household’s own recipes match.'
              : `Nothing in ${activePoolName} matches.`}
          </p>
          {elsewhere > 0 && (
            <Button variant="outline" className="mt-4" onClick={() => setScope({ kind: 'all' })}>
              Search all {recipes.length}
            </Button>
          )}
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {visible.map((r) => (
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
                  {r.poolIds.length > 0 && (
                    <Badge variant="outline" className="text-emerald-700">
                      {r.ownedByMe
                        ? `shared${r.poolIds.length > 1 ? ` ×${r.poolIds.length}` : ''}`
                        : 'from pool'}
                    </Badge>
                  )}
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

      {visible.length > 0 && elsewhere > 0 && (
        <p className="text-muted-foreground text-sm">
          {elsewhere} more {elsewhere === 1 ? 'recipe' : 'recipes'} elsewhere.{' '}
          <button type="button" className="underline" onClick={() => setScope({ kind: 'all' })}>
            Show all
          </button>
        </p>
      )}

      <TrashSection open={showTrash} onToggle={() => setShowTrash((v) => !v)} />
    </main>
  );
}

/**
 * Nudge to categorize recipes imported before meal types existed. Uncategorized
 * recipes are eligible for nothing, so the month auto-fill silently skips them —
 * one tap tags them all (guessed from their titles) so they can be planned again.
 */
function CategorizeBanner({ uncategorized }: { uncategorized: number }) {
  const categorize = useCategorizeUncategorized();
  if (uncategorized === 0 && !categorize.isSuccess) return null;

  if (categorize.isSuccess) {
    return (
      <p className="rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Categorized {categorize.data} recipe{categorize.data === 1 ? '' : 's'}. You can fine-tune
        any of them from the recipe’s edit page.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-600/30 bg-amber-50 px-3 py-2">
      <p className="min-w-0 flex-1 text-sm text-amber-900">
        {uncategorized} recipe{uncategorized === 1 ? " isn't" : "s aren't"} categorized, so auto-fill
        skips {uncategorized === 1 ? 'it' : 'them'}. Sort {uncategorized === 1 ? 'it' : 'them'} by
        type?
      </p>
      <Button size="sm" onClick={() => categorize.mutate()} disabled={categorize.isPending}>
        {categorize.isPending ? 'Sorting…' : 'Categorize'}
      </Button>
    </div>
  );
}

/**
 * One "where it lives" tab. Same pill shape as the shopping list's tabs, with a
 * count so you can tell an empty pool from one you just haven't opened.
 */
function ScopeTab({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background hover:bg-accent',
      )}
    >
      {children}
      <span className={cn('ml-1.5 text-xs', active ? 'opacity-70' : 'text-muted-foreground')}>
        {count}
      </span>
    </button>
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
