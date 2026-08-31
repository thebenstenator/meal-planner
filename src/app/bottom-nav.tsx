import { Link } from '@tanstack/react-router';

import { PRIMARY_NAV } from '@/app/nav-items';
import { useScrollDirection } from '@/app/use-scroll-direction';
import { cn } from '@/lib/utils/cn';

/**
 * Mobile-only bottom navigation. The primary destinations sit within thumb reach
 * instead of the top header (which keeps only the brand, sync, and account menu
 * on a phone). Tucks away on scroll-down and slides back on scroll-up so it never
 * steals a row of content while you're reading a list. Hidden from md up, where
 * the top nav takes over.
 */
export function BottomNav() {
  const hidden = useScrollDirection();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'bg-background fixed inset-x-0 bottom-0 z-40 border-t transition-transform duration-200 md:hidden',
        hidden && 'translate-y-full',
      )}
    >
      <ul className="mx-auto flex max-w-2xl">
        {PRIMARY_NAV.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="flex flex-col items-center gap-0.5 py-2 text-[11px]"
              activeProps={{ className: 'text-primary font-medium' }}
              inactiveProps={{ className: 'text-muted-foreground' }}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
