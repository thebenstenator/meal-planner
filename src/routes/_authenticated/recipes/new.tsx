import { createFileRoute } from '@tanstack/react-router';

import { RecipeForm } from '@/features/recipes/components/recipe-form';

export const Route = createFileRoute('/_authenticated/recipes/new')({
  component: NewRecipe,
});

function NewRecipe() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">New recipe</h1>
      <RecipeForm />
    </main>
  );
}
