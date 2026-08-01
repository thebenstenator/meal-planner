import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/app')({
  component: AppHome,
});

function AppHome() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Your kitchen</h1>
      <p className="text-muted-foreground mt-2">
        Recipes, planner, and shopping list arrive in the coming slices.
      </p>
    </main>
  );
}
