import { createFileRoute, Link } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { useHousehold } from '@/features/household/use-household';

export const Route = createFileRoute('/_authenticated/app')({
  component: AppHome,
});

function AppHome() {
  const { user } = useAuth();
  const { household, isLoading } = useHousehold();

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Your kitchen</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Signed in as {user?.email}.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading your household…</p>
      ) : (
        <p className="text-sm" data-testid="active-household">
          Active household: <strong>{household?.name ?? 'None'}</strong>
        </p>
      )}

      <p className="text-muted-foreground text-sm">
        Recipes, planner, and shopping list arrive in the coming slices.
      </p>

      <Button asChild variant="outline">
        <Link to="/household/settings">Manage household</Link>
      </Button>
    </main>
  );
}
