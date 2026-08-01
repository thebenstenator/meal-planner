/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Injected by Vite `define` (see vite.config.ts).
declare const __BUILD_TIME__: string;
declare const __GIT_COMMIT__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_POSTHOG_KEY: string;
  readonly VITE_POSTHOG_HOST: string;
  readonly VITE_ENABLE_SENTRY: string;
  readonly VITE_ENABLE_POSTHOG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
