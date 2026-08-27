import { createFileRoute } from '@tanstack/react-router';

import { useHousehold } from '@/features/household/use-household';
import { RecipeForm } from '@/features/recipes/components/recipe-form';
import { useRecipe } from '@/features/recipes/use-recipes';

export const Route = createFileRoute('/_authenticated/recipes/$recipeId/edit')({
  component: EditRecipe,
});

function EditRecipe() {
  const { recipeId } = Route.useParams();
  const { data: recipe, isLoading, isError } = useRecipe(recipeId);
  const { householdId } = useHousehold();

  // Editing a recipe your household didn't add forks it: the form saves your
  // changes as a new copy you own, leaving the shared original untouched. You
  // only reach this route for a recipe you can read, so a non-owner here is
  // always someone it's been shared with.
  const isFork = !!recipe && !!householdId && recipe.householdId !== householdId;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{isFork ? 'Edit a copy' : 'Edit recipe'}</h1>
      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn’t load this recipe.</p>}
      {recipe &&
        (isFork ? (
          <RecipeForm forkFromId={recipeId} initial={recipe} />
        ) : (
          <RecipeForm recipeId={recipeId} initial={recipe} />
        ))}
    </main>
  );
}
