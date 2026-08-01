# Mealplan

Meal planning, consolidated shopping lists, and honest grocery budgeting for
households. The product exists to do one thing no competitor does well:
**consolidate ingredients across a month of recipes into one shopping list, in one
unit, at real per-item prices.**

Full planning bundle lives in [`specs/`](./specs) — start with
[`specs/00-README.md`](./specs/00-README.md). Build proceeds one vertical slice at
a time via [`specs/07-vertical-slices.md`](./specs/07-vertical-slices.md).

## Stack

TypeScript (strict) · React 19 + Vite · TanStack Router/Query · Zustand ·
Tailwind v4 + shadcn/ui · Supabase (Postgres, Auth, Realtime, Storage, Edge
Functions) · Dexie (offline) · Claude API (vision parsing) · Vitest · Playwright.

## Getting started

```bash
npm install
cp .env.example .env      # fill in Supabase anon key etc.
npm run dev
```

Requires Node 20+. The local database needs Docker (for the Supabase CLI stack):

```bash
supabase start        # boots local Postgres/Auth/etc.
supabase db reset     # applies supabase/migrations
npm run db:types      # regenerates src/lib/supabase/database.types.ts
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright e2e |
| `npm run db:types` | Regenerate Supabase types from the local DB |

## Project layout

```
src/
  app/            router, providers, root store
  routes/         file-based TanStack routes (_authenticated/* is protected)
  features/       feature-first modules (recipes, planner, shopping-list, ...)
  lib/
    ingredients/  THE ENGINE — pure, no React, no Supabase (Slice 2)
    supabase/     client + generated types
    query/        TanStack Query client
    config/       validated env
    observability/ Sentry + PostHog (flag-gated)
    utils/        cn(), formatCurrency(), ...
  components/ui/  shadcn primitives only
  schemas/        shared Zod (client + Edge Functions)
supabase/
  migrations/     committed SQL migrations
  functions/      Edge Functions (Deno) — Anthropic key lives here only
docs/decisions/   one file per non-obvious decision
```

See [`CHANGELOG.md`](./CHANGELOG.md) for slice-by-slice progress.
