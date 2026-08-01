import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Router context, available in every route's `beforeLoad`/`loader`. The auth
 * guard (see `_authenticated.tsx`) reads `getSession` from here.
 */
export interface RouterContext {
  queryClient: QueryClient;
  /** Resolves the current auth session, or null when signed out. */
  getSession: () => Promise<{ userId: string } | null>;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <div className="min-h-dvh">
      <Outlet />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-muted-foreground">That page doesn’t exist.</p>
    </div>
  );
}
