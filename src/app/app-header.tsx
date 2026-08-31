import { Link } from '@tanstack/react-router';

import { InstallPrompt } from '@/app/install-prompt';
import { PRIMARY_NAV } from '@/app/nav-items';
import { SyncStatus } from '@/app/sync-status';
import { UserMenu } from '@/app/user-menu';
import { Button } from '@/components/ui/button';
import { useHousehold } from '@/features/household/use-household';

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
          {/* Primary links live in the bottom bar on mobile; here from md up. */}
          <div className="hidden items-center gap-1 md:flex">
            {PRIMARY_NAV.map((link) => (
              <Button key={link.to} asChild variant="ghost" size="sm">
                <Link to={link.to}>{link.label}</Link>
              </Button>
            ))}
          </div>
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
