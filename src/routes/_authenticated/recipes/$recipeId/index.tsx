import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRecipeCost } from '@/features/pricing/use-recipe-cost';
import { scaledAmount } from '@/features/recipes/scale';
import { useRecipe, useSoftDeleteRecipe } from '@/features/recipes/use-recipes';
import { formatCurrency } from '@/lib/utils/format-currency';

export const Route = createFileRoute('/_authenticated/recipes/$recipeId/')({
  component: RecipeDetailPage,
});

function RecipeDetailPage() {
  const { recipeId } = Route.useParams();
  const navigate = useNavigate();
  const { data: recipe, isLoading, isError } = useRecipe(recipeId);
  const del = useSoftDeleteRecipe();
  const [confirming, setConfirming] = useState(false);
  const [servings, setServings] = useState<number | null>(null);

  if (isLoading) {
    return <Centered>Loading…</Centered>;
  }
  if (isError || !recipe) {
    return <Centered>Couldn’t load this recipe.</Centered>;
  }

  const targetServings = servings ?? recipe.servings;
  const scaled = targetServings !== recipe.servings;

  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{recipe.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {recipe.mealTypes.map((m) => (
              <Badge key={m} variant="secondary" className="capitalize">
                {m}
              </Badge>
            ))}
            <span className="text-muted-foreground text-sm">{recipe.servings} servings</span>
            {totalMinutes > 0 && (
              <span className="text-muted-foreground text-sm">· {totalMinutes} min</span>
            )}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/recipes/$recipeId/edit" params={{ recipeId }}>
            Edit
          </Link>
        </Button>
      </div>

      {recipe.description && <p className="text-muted-foreground">{recipe.description}</p>}

      <RecipeCostCard ingredients={recipe.ingredients} servings={recipe.servings} />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Ingredients</h2>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Scale to</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              aria-label="Fewer servings"
              disabled={targetServings <= 1}
              onClick={() => setServings(Math.max(1, targetServings - 1))}
            >
              −
            </Button>
            <span className="w-14 text-center tabular-nums" data-testid="scale-servings">
              {targetServings} serv.
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              aria-label="More servings"
              onClick={() => setServings(targetServings + 1)}
            >
              +
            </Button>
            {scaled && (
              <button
                type="button"
                className="text-muted-foreground ml-1 text-xs underline"
                onClick={() => setServings(null)}
              >
                reset
              </button>
            )}
          </div>
        </div>
        {scaled && (
          <p className="text-muted-foreground mb-2 text-xs">
            Scaled from {recipe.servings} — amounts below are for {targetServings} servings.
          </p>
        )}
        <ul className="space-y-1.5">
          {recipe.ingredients.map((ing) => {
            const amount = scaled
              ? scaledAmount(ing.quantity, ing.unit, recipe.servings, targetServings)
              : null;
            return (
              <li key={ing.id ?? ing.rawText} className="flex items-center gap-2 text-sm">
                <span>{ing.rawText}</span>
                {amount && <span className="font-medium text-emerald-700">→ {amount}</span>}
                {ing.isOptional && <span className="text-muted-foreground text-xs">(optional)</span>}
                {ing.canonicalName ? (
                  <Badge variant="outline">{ing.canonicalName}</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600">
                    needs match
                  </Badge>
                )}
              </li>
            );
          })}
          {recipe.ingredients.length === 0 && (
            <li className="text-muted-foreground text-sm">No ingredients yet.</li>
          )}
        </ul>
      </section>

      {recipe.instructions && (
        <section>
          <h2 className="mb-2 font-semibold">Instructions</h2>
          <div className="whitespace-pre-wrap text-sm">{recipe.instructions}</div>
        </section>
      )}

      {(recipe.source || recipe.tags.length > 0) && (
        <section className="text-muted-foreground space-y-1 text-sm">
          {recipe.source && <p>Source: {recipe.source}</p>}
          {recipe.tags.length > 0 && <p>Tags: {recipe.tags.join(', ')}</p>}
        </section>
      )}

      <div className="border-t pt-4">
        {!confirming ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Delete recipe
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm">Delete “{recipe.title}”? You can restore it later.</span>
            <Button
              variant="destructive"
              size="sm"
              disabled={del.isPending}
              onClick={async () => {
                await del.mutateAsync(recipeId);
                await navigate({ to: '/recipes' });
              }}
            >
              {del.isPending ? 'Deleting…' : 'Delete'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm">{children}</main>;
}

function RecipeCostCard({
  ingredients,
  servings,
}: {
  ingredients: { quantity: number | null; unit: string | null; canonicalId: string | null; isOptional: boolean }[];
  servings: number;
}) {
  const cost = useRecipeCost(ingredients, servings);

  if (cost.isLoading) return null;

  // No default store / no prices captured yet — point the user at pricing.
  if (!cost.storeId || cost.pricedCount === 0) {
    return (
      <div className="bg-muted/40 rounded-lg border p-4 text-sm">
        <span className="text-muted-foreground">
          {cost.storeId
            ? 'No prices yet for these ingredients. '
            : 'Set a default store and prices to estimate cost. '}
        </span>
        <Link to="/stores" className="underline">
          {cost.storeId ? 'Add prices' : 'Set up pricing'}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Estimated cost</span>
        <span className="text-xl font-semibold" data-testid="recipe-cost">
          {formatCurrency(cost.totalCents)}
        </span>
      </div>
      <div className="text-muted-foreground mt-1 flex items-baseline justify-between text-sm">
        <span>{formatCurrency(cost.perServingCents)} / serving</span>
        {cost.unpricedCount > 0 && (
          <span>
            {cost.unpricedCount} of {cost.pricedCount + cost.unpricedCount} not priced
          </span>
        )}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Based on the amount this recipe uses, at your default store.
      </p>
    </div>
  );
}
