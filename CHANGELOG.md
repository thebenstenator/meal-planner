# Changelog

All notable changes to this project are documented here. One entry per slice
(see `specs/07-vertical-slices.md`).

## [Unreleased]

### Slice 4 — Recipes (manual entry)

- Migration: `recipe` + `recipe_ingredient` with RLS, soft-delete (`deleted_at`,
  30-day recovery — never hard-delete), and `raw_text` kept verbatim. A
  `save_recipe` RPC upserts a recipe and replaces its ingredient rows in one
  transaction so a partial write can't lose a recipe.
- Recipe library: grid, title search, meal-type filter, empty/loading/error
  states, and a "recently deleted" section with restore.
- Recipe create/edit form (title, meal types, servings, prep/cook, description,
  instructions, source, tags) with an ingredient editor.
- Ingredient editor: **paste a block of text → runs the Slice 2 parser → matches
  each line via the Slice 3 matcher → prefilled rows for review**, plus manual
  rows, per-row canonical autocomplete (with create-on-the-fly), quantity/unit
  edits, optional flag, and needs-review flags for unmatched/low-confidence.
- Recipe detail view; soft-delete with confirmation.
- New primitives: `Textarea` and a `CanonicalCombobox` autocomplete.
- Tests: recipe-form schema unit tests; e2e creating a recipe via paste (cream
  cheese matched), seeing it in the library, soft-deleting, and restoring.

### Slice 3 — Canonical Ingredients

- Migration: `canonical_ingredient` (global seed rows + household rows) with
  `pg_trgm` GIN indexes, soft-merge via `merged_into_id`, and RLS (read global +
  own; write own household rows only). Plus `household_ingredient_map` for
  learned raw-name → canonical mappings.
- `match_canonical_ingredient` RPC: ordered exact → alias → household-learned →
  trigram, with a similarity threshold and a runner-up gap so ambiguous matches
  return nothing rather than guessing. `resolve_canonical` follows merge chains.
- Seeded 172 global canonical ingredients with aliases, categories, default
  units, densities (baking staples), count_to_gram (eggs/garlic/etc.), and
  package sizes. A starter set meant to grow toward ~500.
- Matching service + hooks: match, search/browse, create/edit household rows,
  merge, and learn-mapping. `toCanonicalInfo` maps rows into the engine's shape.
- Ingredients admin UI: a "test the matcher" panel (philly cream cheese →
  cream cheese), search/browse with global/yours badges, add/edit household
  ingredients, and merge.
- Tests: unit test for the row→engine mapping; e2e verifying match ordering and
  threshold (exact/alias/trigram/no-match) through the real database.

### Slice 2 — Ingredient Engine

- New pure module `src/lib/ingredients/` (no React, no Supabase) — the product's
  core. Pipeline: parse → normalize → convert → consolidate → round.
- Fixed `Unit` enum (mass/volume/count/vague), conversion metadata, and an
  exhaustive alias table (`tablespoon`/`Tbs`/`T` → `tbsp`, container words, etc.).
- Deterministic parser: unicode + mixed fractions, ranges (upper bound),
  parentheticals before/after the unit ("1 (8 oz) package" and "1 package
  (16 oz)"), container multiply-out, "+" compounds, "a/an", optional flags, and
  "to taste"/"as needed" no-quantity lines.
- Converters: same-dimension (always), volume↔mass via density, count↔mass via
  count_to_gram. Unconvertible pairs return a reason rather than guessing.
- Consolidation groups by canonical id, scales by servings, sums into a common
  unit, and flags `unresolved` with per-unit subtotals when it can't merge
  cleanly. Purchase rounding rounds up to whole packages.
- 215 real fixture lines, snapshot-tested; explicit tests for every unresolved
  case. 53 engine unit tests total.
- Scratch CLI `npm run consolidate -- scripts/sample-ingredients.txt` prints a
  consolidated list (8 oz + 4 oz cream cheese → 12 oz → buy 2 × 8 oz).

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
