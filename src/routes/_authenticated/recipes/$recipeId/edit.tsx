import { createFileRoute } from '@tanstack/react-router';

import { RecipeForm } from '@/features/recipes/components/recipe-form';
import { useRecipe } from '@/features/recipes/use-recipes';

export const Route = createFileRoute('/_authenticated/recipes/$recipeId/edit')({
  component: EditRecipe,
});

function EditRecipe() {
  const { recipeId } = Route.useParams();
  const { data: recipe, isLoading, isError } = useRecipe(recipeId);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Edit recipe</h1>
      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn’t load this recipe.</p>}
      {recipe && <RecipeForm recipeId={recipeId} initial={recipe} />}
    </main>
  );
}
