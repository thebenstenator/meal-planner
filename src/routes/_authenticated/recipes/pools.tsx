import { createFileRoute, Link } from '@tanstack/react-router';

import { PoolPanel } from '@/features/recipes/components/pool-panel';

export const Route = createFileRoute('/_authenticated/recipes/pools')({
  component: ManagePoolsPage,
});

/**
 * The home for shared recipe pools — starting/joining them, invites, members,
 * share-back and deletion. It used to sit open on the recipe library; it's its
 * own page now so the library stays about recipes, reached by "Manage pools".
 */
function ManagePoolsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div className="space-y-1">
        <Link to="/recipes" className="text-muted-foreground text-sm underline">
          ← Recipes
        </Link>
        <h1 className="text-2xl font-semibold">Shared pools</h1>
        <p className="text-muted-foreground text-sm">
          Share your recipes with extended family or friends, and see theirs. Your shopping list,
          pantry and plan stay private.
        </p>
      </div>

      <PoolPanel />
    </main>
  );
}
