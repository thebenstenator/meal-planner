# 10 — Conventions

Rules for the coding agent. Follow these unless a slice says otherwise.

---

## Folder structure

```
src/
  app/                 # router, providers, root layout
  features/
    recipes/           # components, hooks, queries, types — colocated
    planner/
    shopping-list/
    pricing/
    pantry/
    household/
  lib/
    ingredients/       # THE ENGINE — pure, no React, no Supabase
    supabase/          # client, generated types
    offline/           # Dexie schema, mutation queue
    utils/
  components/ui/       # shadcn primitives only
  schemas/             # Zod — shared with Edge Functions
supabase/
  migrations/
  functions/
    parse-recipe/
    parse-receipt/
docs/
  decisions/           # one short markdown file per non-obvious decision
```

**Feature-first, not type-first.** Everything about recipes lives under
`features/recipes/`. Do not create global `components/`, `hooks/`, `types/`
dumping grounds.

## TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`
- No `any`. Use `unknown` and narrow.
- Generate database types from Supabase (`supabase gen types`) and commit them
- Zod schemas are the source of truth for anything crossing a boundary
  (API response, AI output, form input). Infer TS types from Zod, not the reverse.

## Money

- **Store all money as integer cents.** Never floats. Never `number` dollars.
- Format at the display layer only, via a single `formatCurrency()` helper.

## Quantities

- Store as `numeric` in Postgres, handle as `number` in TS
- Never do unit math outside `lib/ingredients/`. If a component needs to convert
  something, it calls the engine.

## Dates

- `date-fns` only. No raw `Date` arithmetic, no moment.
- Plan entries use plain `date` (no time, no timezone). A meal is on a day, not
  at an instant. This avoids an entire category of timezone bugs.

## Data access

- All server state through TanStack Query. No `useEffect` + `fetch`.
- Query keys are structured arrays: `['recipes', householdId, filters]`
- Mutations invalidate precisely; avoid blanket invalidation
- Every query is scoped by `householdId` in the key, even though RLS enforces it
  server-side. Belt and suspenders.

## Security

- RLS on **every** user-data table. A table without a policy is a bug.
- Never trust the client for entitlement, quota, or household membership checks
- The Anthropic API key exists only in Edge Function environment variables
- Validate every AI response with Zod before it touches the database

## UI

- Mobile-first. Design at 375px, then widen. The primary use case is one hand,
  in a grocery aisle.
- Every list/data view needs four states: loading, empty, error, populated.
  Empty states should teach, not just say "no items."
- Touch targets ≥ 44px
- Optimistic updates for check-off, drag, and any high-frequency interaction
- Respect safe areas — this ends up in a native shell
- Accessibility: keyboard navigable, labeled inputs, sufficient contrast.
  shadcn/Radix gives most of this for free; don't undo it.

## Testing

| Layer | Tool | Bar |
|---|---|---|
| `lib/ingredients/` | Vitest | Near-exhaustive. This is the one place to be rigorous. |
| Services / hooks | Vitest | Happy path + the failure that matters |
| Components | Vitest + Testing Library | Only for non-trivial logic |
| Critical flows | Playwright | Auth, plan→list generation, offline sync, AI import |

**Rule: every consolidation bug gets a regression test written before the fix.**

## Git

- Conventional commits: `feat(shopping-list): consolidate across recipes`
- One branch per slice: `slice/06-shopping-list-generation`
- Squash merge to `main`
- `main` is always deployable

## Definition of done (per slice)

```
- [ ] Migration written + RLS policy added
- [ ] Zod schema updated (shared client/server)
- [ ] Service/engine logic with unit tests
- [ ] UI built, verified at 375px
- [ ] Loading / empty / error states
- [ ] Offline behavior considered
- [ ] Realtime sync verified with two sessions
- [ ] E2E test for the happy path
- [ ] CHANGELOG updated
- [ ] Non-obvious decisions written to docs/decisions/
```

## Things to never do

- Never overwrite `recipe_ingredient.raw_text`
- Never hard-delete a recipe
- Never store money as a float
- Never put the Anthropic key in client code
- Never auto-save AI output without user review
- Never silently guess a unit conversion — surface it as unresolved
- Never add a V2 feature to a V1 slice because it "would only take an hour"
