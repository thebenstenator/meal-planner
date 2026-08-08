import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * The root path is just a router: signed-in users go straight into the app,
 * everyone else to the login screen. No landing splash — it was an extra tap
 * with nothing behind it.
 */
export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const session = await context.getSession();
    throw redirect({ to: session ? '/app' : '/login' });
  },
});
