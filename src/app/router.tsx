import { createRouter } from '@tanstack/react-router';

import { queryClient } from '@/lib/query/client';
import { supabase } from '@/lib/supabase/client';
import { routeTree } from '@/routeTree.gen';

/** Resolve the current session for the router's auth guard (see __root.tsx). */
async function getSession(): Promise<{ userId: string } | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { userId: data.session.user.id } : null;
}

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
    getSession,
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
