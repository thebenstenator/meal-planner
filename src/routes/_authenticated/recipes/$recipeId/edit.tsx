import { createFileRoute, Navigate } from '@tanstack/react-router';

import { useHousehold } from '@/features/household/use-household';
import { RecipeForm } from '@/features/recipes/components/recipe-form';
import { canEditRecipe } from '@/features/recipes/permissions';
import { usePool } from '@/features/recipes/use-pool';
import { useRecipe } from '@/features/recipes/use-recipes';

export const Route = createFileRoute('/_authenticated/recipes/$recipeId/edit')({
  component: EditRecipe,
});

function EditRecipe() {
  const { recipeId } = Route.useParams();
  const { data: recipe, isLoading, isError } = useRecipe(recipeId);
  const { householdId } = useHousehold();
  const { data: pool, isLoading: poolLoading } = usePool();

  // A member can only edit recipes they added; bounce anyone else back to the
  // read-only detail. RLS would reject the save anyway — this avoids a dead form.
  if (recipe && householdId && !poolLoading) {
    const canEdit = canEditRecipe({
      ownedByMe: recipe.householdId === householdId,
      recipePoolId: recipe.poolId,
      myPool: pool ? { id: pool.id, role: pool.role } : null,
    });
    if (!canEdit) {
      return <Navigate to="/recipes/$recipeId" params={{ recipeId }} replace />;
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Edit recipe</h1>
      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn’t load this recipe.</p>}
      {recipe && <RecipeForm recipeId={recipeId} initial={recipe} />}
    </main>
  );
}
