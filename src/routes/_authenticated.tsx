import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

import { AppHeader } from '@/app/app-header';
import { BottomNav } from '@/app/bottom-nav';
import { Loading } from '@/components/ui/loading';
import { useAuth } from '@/features/auth/use-auth';
import { useHousehold } from '@/features/household/use-household';

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
  const { loading: authLoading } = useAuth();
  const { isResolving } = useHousehold();
  // Every page hangs its queries and writes off the household id. Hold pages
  // back until it's known, so nothing renders a control that would write with
  // household_id = null (the cache usually has it, so this is a cold start only).
  const ready = !authLoading && !isResolving;

  return (
    <div className="min-h-dvh">
      <AppHeader />
      {/* Bottom padding on mobile so content clears the fixed bottom nav. */}
      <div className="pb-20 md:pb-0">
        {ready ? (
          <Outlet />
        ) : (
          <p className="text-muted-foreground px-4 py-8 text-sm">
            <Loading>Loading your household</Loading>
          </p>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
