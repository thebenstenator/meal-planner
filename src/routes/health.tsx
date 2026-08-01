import { createFileRoute } from '@tanstack/react-router';

import { supabase } from '@/lib/supabase/client';

export const Route = createFileRoute('/health')({
  component: HealthCheck,
  loader: async () => {
    // A cheap round-trip that proves the client is configured. Auth is not yet
    // required, so a missing session is a healthy "signed out", not an error.
    const { error } = await supabase.auth.getSession();
    return {
      status: 'ok' as const,
      supabaseReachable: !error,
      builtAt: __BUILD_TIME__,
      commit: __GIT_COMMIT__,
    };
  },
});

function HealthCheck() {
  const data = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-4 text-xl font-semibold">Health</h1>
      <pre
        data-testid="health-payload"
        className="bg-muted overflow-auto rounded-md p-4 text-sm"
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}
