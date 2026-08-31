import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import { AppHeader } from '@/app/app-header';
import { BottomNav } from '@/app/bottom-nav';

/**
 * Protected-route wrapper. Any route placed under `_authenticated/` requires a
 * session; unauthenticated users are redirected to `/login` with a `redirect`
 * search param so they return here after signing in.
 *
 * The real auth provider (Supabase email/password + Google OAuth) is wired in
 * Slice 1; the guard already reads the session via router context so no route
 * code changes when that lands.
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.getSession();
    if (!session) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      });
    }
    return { session };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-dvh">
      <AppHeader />
      {/* Bottom padding on mobile so content clears the fixed bottom nav. */}
      <div className="pb-16 md:pb-0">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
