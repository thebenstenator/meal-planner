import { Link, useNavigate } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { useHousehold } from '@/features/household/use-household';

export function AppHeader() {
  const { signOut } = useAuth();
  const { household } = useHousehold();
  const navigate = useNavigate();

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-2 px-4">
        <Link to="/app" className="font-semibold">
          {household?.name ?? 'Mealplan'}
        </Link>
        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link to="/planner">Plan</Link>
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
