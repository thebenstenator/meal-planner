import { z } from 'zod';

/**
 * Validated, typed access to `import.meta.env`. Import from here — never read
 * `import.meta.env` directly elsewhere, so every env var has one schema and one
 * failure point.
 *
 * Only VITE_-prefixed vars exist in the client bundle. Server-only secrets
 * (ANTHROPIC_API_KEY, service role key) live in Edge Function env and must
 * never appear here.
 */
const boolFromString = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

/**
 * The Supabase CLI's well-known local-dev anon key (issuer `supabase-demo`). It
 * is public, identical on every machine, and only ever valid against a local
 * stack — safe as a default so `npm run dev` and CI boot without a real `.env`.
 * Staging/production override it via env.
 */
const LOCAL_DEV_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().default('http://127.0.0.1:54321'),
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .default(LOCAL_DEV_ANON_KEY)
    .transform((v) => (v.length > 0 ? v : LOCAL_DEV_ANON_KEY)),

  VITE_SENTRY_DSN: z.string().default(''),
  VITE_POSTHOG_KEY: z.string().default(''),
  VITE_POSTHOG_HOST: z.string().url().default('https://us.i.posthog.com'),

  VITE_ENABLE_SENTRY: boolFromString,
  VITE_ENABLE_POSTHOG: boolFromString,
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  // Fail loud and early — a misconfigured environment should never boot.
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables. See .env.example.');
}

export const env = parsed.data;

/** Sentry is only active when explicitly enabled AND a DSN is present. */
export const sentryEnabled = env.VITE_ENABLE_SENTRY && env.VITE_SENTRY_DSN.length > 0;

/** PostHog is only active when explicitly enabled AND a key is present. */
export const posthogEnabled =
  env.VITE_ENABLE_POSTHOG && env.VITE_POSTHOG_KEY.length > 0;
