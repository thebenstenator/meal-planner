import { createFileRoute, redirect } from '@tanstack/react-router';

import { getLandingPref } from '@/features/preferences/landing';

/**
 * The root path is just a router: signed-in users go to their chosen start page
 * (a per-person preference, default Plan), everyone else to the login screen.
 * This is the "boot the app" path — a cold PWA launch or bookmark. No landing
 * splash; it was an extra tap with nothing behind it.
 */
export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const session = await context.getSession();
    throw redirect({ to: session ? getLandingPref() : '/login' });
  },
});
