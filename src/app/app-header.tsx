import { Link, useNavigate } from '@tanstack/react-router';

import { InstallPrompt } from '@/app/install-prompt';
import { SyncStatus } from '@/app/sync-status';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { useHousehold } from '@/features/household/use-household';

export function AppHeader() {
  const { signOut } = useAuth();
  const { household } = useHousehold();
  const navigate = useNavigate();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-2">
          <Link to="/app" className="font-semibold">
            {household?.name ?? 'Mealplan'}
          </Link>
          <SyncStatus />
        </div>
        <nav className="flex flex-wrap items-center justify-end gap-1">
          <InstallPrompt />
          <Button asChild variant="ghost" size="sm">
            <Link to="/planner">Plan</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/shopping-list">List</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/spending">Spending</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/stores">Stores</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/recipes">Recipes</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/ingredients">Ingredients</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/household/settings">Household</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              await navigate({ to: '/login' });
            }}
          >
            Sign out
          </Button>
        </nav>
      </div>
    </header>
  );
}
