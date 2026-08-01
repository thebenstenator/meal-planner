import { env, posthogEnabled, sentryEnabled } from '@/lib/config/env';

/**
 * Initialize error + product analytics. Both are strictly opt-in via env flags
 * (see 07-vertical-slices.md, Slice 0) and are dynamically imported so their
 * SDKs are excluded from the bundle when disabled.
 */
export async function initObservability(): Promise<void> {
  if (sentryEnabled) {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn: env.VITE_SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: import.meta.env.MODE,
    });
  }

  if (posthogEnabled) {
    const { default: posthog } = await import('posthog-js');
    posthog.init(env.VITE_POSTHOG_KEY, {
      api_host: env.VITE_POSTHOG_HOST,
      capture_pageview: true,
      person_profiles: 'identified_only',
    });
  }
}
