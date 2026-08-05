import { Link } from '@tanstack/react-router';

import { InstallPrompt } from '@/app/install-prompt';
import { SyncStatus } from '@/app/sync-status';
import { UserMenu } from '@/app/user-menu';
import { Button } from '@/components/ui/button';
import { useHousehold } from '@/features/household/use-household';

// The day-to-day destinations. Occasional/settings pages live in the user menu.
const PRIMARY_LINKS = [
  { to: '/planner', label: 'Plan' },
  { to: '/suggest', label: 'Ideas' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/pantry', label: 'Pantry' },
  { to: '/shopping-list', label: 'List' },
] as const;

export function AppHeader() {
  const { household } = useHousehold();

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
          {PRIMARY_LINKS.map((link) => (
            <Button key={link.to} asChild variant="ghost" size="sm">
              <Link to={link.to}>{link.label}</Link>
            </Button>
          ))}
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
