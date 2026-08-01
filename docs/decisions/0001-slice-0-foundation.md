# 0001 — Slice 0 foundation choices

Status: accepted · Date: 2026-08-01

Non-obvious decisions made while scaffolding the foundation. The stack itself is
fixed by `specs/02-tech-stack.md`; this records the judgment calls that spec left
open.

## Version pins that diverged from first guesses

- **Vitest 3, not 2.** Vitest 2.1 pins Vite 5 as a peer, which pulled a second
  copy of Vite into the tree and produced `defineConfig`/`Plugin` type conflicts
  in `vite.config.ts`. Vitest 3 aligns on Vite 6, dedupes to a single Vite, and
  also cleared all `npm audit` vulnerabilities that came from the Vite 5 chain.
- **vite-plugin-pwa ^0.21, not ^0.20.** 0.20 caps its Vite peer at 5; 0.21
  supports Vite 6.

## `routeTree.gen.ts` is committed, not gitignored

TanStack Router's plugin generates it during a Vite run, but our `typecheck`
(`tsc -b`) and CI run *before* any Vite invocation. Committing the generated file
keeps typecheck self-contained. It's regenerated automatically on `dev`/`build`.

## Vitest config lives inside `vite.config.ts`

One config file, `defineConfig` imported from `vitest/config` so the `test` key
is typed. Playwright's `e2e/` dir is excluded from the Vitest run so the two
suites never collide.

## Observability is dynamically imported

Sentry and PostHog are gated behind `VITE_ENABLE_SENTRY` / `VITE_ENABLE_POSTHOG`
**and** a non-empty DSN/key, and are `await import()`-ed only when enabled, so
their SDKs stay out of the default bundle.

## Env access is centralized and validated

Nothing reads `import.meta.env` directly except `src/lib/config/env.ts`, which
validates everything through Zod and throws on boot if misconfigured. This is the
client-side mirror of the "Zod at every boundary" rule.

## Local Supabase stack needs Docker

`supabase init` and the committed migrations don't require Docker, but
`supabase start` / `supabase db reset` do. Docker was not available in the
scaffolding environment, so the extensions migration is committed but not yet
applied to a running local database. First developer with Docker should run
`supabase start && supabase db reset`, then `npm run db:types`.
