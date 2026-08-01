# Changelog

All notable changes to this project are documented here. One entry per slice
(see `specs/07-vertical-slices.md`).

## [Unreleased]

### Slice 0 — Foundation

- Vite + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`) with `@/*`
  path alias.
- Tailwind CSS v4 + shadcn/ui (new-york) with base design tokens and a `Button`
  primitive. Mobile-first tokens; 44px touch targets; safe-area padding.
- TanStack Router (file-based) with a `_authenticated` protected-route wrapper
  that redirects to `/login`, plus public `/`, `/login`, and `/health` routes.
- TanStack Query client and a Zustand UI-store skeleton.
- Supabase browser client + placeholder generated `database.types.ts`.
  Supabase CLI initialized; `supabase/migrations/` committed with an initial
  extensions migration (`pgcrypto`, `pg_trgm`).
- Shared Zod schema directory (`src/schemas/`) for client + Edge Functions,
  with common primitives (cents, uuid, iso date) and a validated env module.
- Sentry + PostHog wired behind `VITE_ENABLE_*` env flags (dynamically imported,
  excluded from the bundle when disabled).
- Vitest (jsdom) + Testing Library with a `formatCurrency` unit test; Playwright
  with a mobile-viewport e2e smoke suite (landing, health, auth redirect).
- GitHub Actions CI: typecheck, lint, test, build, and Playwright e2e on PR.
- Vercel SPA deploy config (`vercel.json`).

**Prerequisite not yet satisfied in this environment:** Docker is required to run
the local Supabase stack (`supabase start` / `supabase db reset`). Config and
migrations are committed and valid; applying them locally needs Docker installed.
