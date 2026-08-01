# Changelog

All notable changes to this project are documented here. One entry per slice
(see `specs/07-vertical-slices.md`).

## [Unreleased]

### Slice 1 — Auth & Household

- Migration: `household`, `household_member`, `household_invite` with a shared
  `updated_at` trigger and RLS on all three (membership-scoped via
  `is_household_member` / `is_household_owner` SECURITY DEFINER helpers).
- `handle_new_user()` trigger auto-creates a household and owner membership on
  signup. Invite create/accept and member listing via SECURITY DEFINER RPCs.
- Email/password auth (`AuthProvider` + `useAuth`), session-driven protected
  routes, login/signup screen. Google OAuth deferred behind a config flag
  (`GOOGLE_OAUTH_ENABLED`) — see docs/decisions/0002.
- `useHousehold()` hook (the household id every later query depends on) and
  household mutations (rename, create invite, accept invite).
- Household settings page: rename (owner-only), members list, invite-code
  generation, and join-by-code.
- Shared Zod schemas for credentials, invite codes, and household settings.
- Tests: unit tests for auth schemas; two-context e2e (owner invites, partner
  joins, sees the shared household) plus the auto-household e2e.
- shadcn primitives: `Input`, `Label`, `Card`.

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
