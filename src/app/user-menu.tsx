import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { useAuth } from '@/features/auth/use-auth';

// Less-used / settings destinations tucked behind the avatar.
const MENU_LINKS = [
  { to: '/spending', label: 'Spending' },
  { to: '/receipts', label: 'Scan receipt' },
  { to: '/stores', label: 'Stores' },
  { to: '/ingredients', label: 'Ingredients' },
  { to: '/household/settings', label: 'Household settings' },
] as const;

export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const email = user?.email ?? '';
  const fullName = ((user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? '').trim();
  const initials = fullName
    ? fullName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : email.slice(0, 2).toUpperCase() || '?';

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="bg-primary text-primary-foreground hover:opacity-90 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
      >
        {initials}
      </button>

      {open && (
        <>
          {/* Backdrop closes the menu on any outside tap. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="bg-popover absolute right-0 z-20 mt-1 w-56 rounded-md border p-1 shadow-md"
          >
            {(fullName || email) && (
              <div className="px-2 py-1.5">
                {fullName && <div className="truncate text-sm font-medium">{fullName}</div>}
                {email && <div className="text-muted-foreground truncate text-xs">{email}</div>}
              </div>
            )}
            {MENU_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="hover:bg-accent block rounded px-2 py-1.5 text-sm"
              >
                {item.label}
              </Link>
            ))}
            <div className="bg-border my-1 h-px" />
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                await signOut();
                await navigate({ to: '/login' });
              }}
              className="hover:bg-accent block w-full rounded px-2 py-1.5 text-left text-sm"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
