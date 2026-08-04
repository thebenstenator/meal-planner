import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRecipe, useSoftDeleteRecipe } from '@/features/recipes/use-recipes';

export const Route = createFileRoute('/_authenticated/recipes/$recipeId/')({
  component: RecipeDetailPage,
});

function RecipeDetailPage() {
  const { recipeId } = Route.useParams();
  const navigate = useNavigate();
  const { data: recipe, isLoading, isError } = useRecipe(recipeId);
  const del = useSoftDeleteRecipe();
  const [confirming, setConfirming] = useState(false);

  if (isLoading) {
    return <Centered>Loading…</Centered>;
  }
  if (isError || !recipe) {
    return <Centered>Couldn’t load this recipe.</Centered>;
  }

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

      <section>
        <h2 className="mb-2 font-semibold">Ingredients</h2>
        <ul className="space-y-1.5">
          {recipe.ingredients.map((ing) => (
            <li key={ing.id ?? ing.rawText} className="flex items-center gap-2 text-sm">
              <span>{ing.rawText}</span>
              {ing.isOptional && <span className="text-muted-foreground text-xs">(optional)</span>}
              {ing.canonicalName ? (
                <Badge variant="outline">{ing.canonicalName}</Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600">
                  needs match
                </Badge>
              )}
            </li>
          ))}
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
