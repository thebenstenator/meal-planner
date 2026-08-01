# 07 — Vertical Slices (Build Plan)

**This is the file the coding agent works from.**

Each slice is end-to-end: migration → types → engine/service → UI → tests.
Each slice ends in something a human can click. Do not batch slices. Do not
start a slice before the previous one is merged and demoable.

At the end of every slice: run the full test suite, run the linter, update
`CHANGELOG.md`, and write any non-obvious decision to `/docs/decisions/`.

---

# V1 — MVP

## Slice 0 — Foundation
*No user-facing feature. Everything after depends on it.*

- [ ] Vite + React 19 + TypeScript (strict), path aliases
- [ ] Tailwind v4 + shadcn/ui initialized, base design tokens
- [ ] TanStack Router with a protected-route wrapper
- [ ] TanStack Query client, Zustand store skeleton
- [ ] Supabase local stack via CLI, `supabase/migrations/` committed
- [ ] Zod schema directory shared between client and Edge Functions
- [ ] Vitest + Playwright configured with one smoke test each
- [ ] GitHub Actions: typecheck, lint, test on PR
- [ ] Vercel deploy on merge to `main`
- [ ] Sentry + PostHog wired, gated behind env flags

**Demo:** an empty deployed app with a working health-check route and green CI.

---

## Slice 1 — Auth & Household
- [ ] Migration: `household`, `household_member`, `household_invite`
- [ ] RLS policies on all three (use the shared helper pattern from `03`)
- [ ] Supabase Auth: email/password + Google OAuth
- [ ] Sign up → auto-create a household → become owner
- [ ] Household settings page: rename, view members
- [ ] Generate an invite code; join-by-code flow
- [ ] `useHousehold()` hook — the household id every other query depends on
- [ ] E2E: two browser contexts, user A invites user B, B sees the household

**Demo:** two accounts sharing one household.

---

## Slice 2 — Ingredient Engine (pure module, no UI)
*Build this before anything that consumes it. It is the product.*

- [ ] `src/lib/ingredients/` — no React, no Supabase imports
- [ ] Unit enum + exhaustive alias table
- [ ] Deterministic parser (fractions, mixed numbers, ranges, parentheticals)
- [ ] Name cleaner + descriptor extraction
- [ ] Same-dimension converter (mass↔mass, volume↔volume)
- [ ] Density-based volume↔mass converter
- [ ] Count converter with `count_to_gram`
- [ ] Consolidation function: array of parsed ingredients → merged results
- [ ] Purchase rounding against `unit_size`
- [ ] **200+ fixture lines from real recipes, snapshot tested**
- [ ] Explicit tests for every unresolved case

**Demo:** `npm test` green, plus a scratch CLI script that takes a text file of
ingredient lines and prints the consolidated result.

---

## Slice 3 — Canonical Ingredients
- [ ] Migration: `canonical_ingredient` with `pg_trgm` indexes
- [ ] Seed ~500 global ingredients: name, aliases, category, default unit,
      density where known, typical package size
- [ ] Matching service: exact → alias → household-learned → trigram → no match
- [ ] Household-learned mapping table + write path
- [ ] Admin-ish UI: browse, search, edit, merge canonical ingredients
- [ ] Tests for match ordering and threshold behavior

**Demo:** type "philly cream cheese", get matched to canonical "cream cheese".

---

## Slice 4 — Recipes (manual entry)
- [ ] Migration: `recipe`, `recipe_ingredient`
- [ ] Recipe create/edit form: title, servings, meal types, instructions
- [ ] Ingredient row editor with autocomplete against canonical ingredients
- [ ] Paste-a-block-of-text mode → runs the parser → prefills rows for review
- [ ] Recipe library: grid, search, filter by meal type
- [ ] Recipe detail view
- [ ] Delete with confirmation (recipes are irreplaceable — soft delete, 30-day
      recovery)

**Demo:** add three real family recipes by hand and see them in the library.

---

## Slice 5 — Planner
- [ ] Migration: `plan_entry`
- [ ] Monthly calendar grid, month navigation
- [ ] Weekly view toggle over the same data
- [ ] Assign a recipe to a date + slot (tap flow on mobile, drag on desktop)
- [ ] Multiple entries per slot with ordering
- [ ] Entry kinds: recipe / leftovers / eating out / note
- [ ] Remove and move entries
- [ ] Realtime subscription so a partner's edits appear live

**Demo:** plan a full month including leftover and eat-out days, on two devices
at once.

---

## Slice 6 — Shopping List Generation
*The payoff slice. Everything before this exists to make it possible.*

- [ ] Migration: `shopping_list`, `shopping_list_item`, `shopping_list_item_source`
- [ ] Generation service: date range → plan entries → recipe ingredients →
      engine → persisted list items
- [ ] Leftovers/eating-out entries contribute nothing (test this explicitly)
- [ ] Aisle/category grouping in the UI
- [ ] Expandable provenance: "12 oz cream cheese — from Recipe A (8 oz),
      Recipe B (4 oz)"
- [ ] Unresolved-merge review UI with [Set conversion] / [Keep separate]
- [ ] Saving a conversion writes back to the canonical ingredient
- [ ] Check-off items, ad-hoc items, manual quantity override
- [ ] Regenerate a list when the plan changes, preserving check-off state

**Demo:** two recipes with 8 oz and 4 oz cream cheese produce one 12 oz line item
that rounds to "2 × 8 oz package".

---

## Slice 7 — Stores & Pricing
- [ ] Migration: `store`, `price_record` (append-only)
- [ ] Store CRUD, set a default store
- [ ] Inline price entry from the shopping list ("no price yet — add one")
- [ ] Price entry captures package price + package size, not unit price
- [ ] Current-price view (most recent record per ingredient per store)
- [ ] Staleness indicator with a configurable threshold
- [ ] Projected list total, with an explicit count of unpriced items
- [ ] Bulk "review stale prices" screen

**Demo:** a fully priced month with a credible projected total.

---

## Slice 8 — Offline & PWA
- [ ] `vite-plugin-pwa` with a Workbox config, real manifest and icons
- [ ] Dexie mirror of: active shopping list, recipes, plan entries
- [ ] Offline mutation queue with replay on reconnect
- [ ] Last-write-wins per field, with a visible sync status indicator
- [ ] Install prompt
- [ ] E2E: go offline, check off ten items, come back online, verify sync

**Demo:** airplane mode in a grocery store, everything still works.

---

## Slice 9 — AI Recipe Import
*Last in V1 because everything must work without it first.*

- [ ] Supabase Edge Function `parse-recipe` (API key never leaves the server)
- [ ] Multi-image capture UI: add page 1, add page 2, ... then parse as one recipe
- [ ] Claude vision call with a strict JSON output schema
- [ ] Zod validation of the model response — reject and retry once on failure
- [ ] Parsed ingredients run through the engine's matcher before display
- [ ] **Mandatory review screen** — low-confidence fields highlighted, nothing
      saves without user confirmation
- [ ] Per-household rate limiting and a usage counter (cost control)
- [ ] Graceful failure → fall back to manual entry with the image attached

**Demo:** photograph a two-page cookbook recipe, confirm the parse, cook from it.

> **V1 ships here.** Deploy, get real households using it, fix what breaks
> before touching V2.

---

# V2 — Spreadsheet Layer

## Slice 10 — Recipe Scaling
- [ ] `servings_override` on plan entries, UI control
- [ ] Scaling factor applied through consolidation
- [ ] Scaled quantities shown on the recipe detail view
- [ ] Tests for fractional scaling and rounding interaction

## Slice 11 — Pantry
- [ ] Migration: `pantry_item`
- [ ] Pantry UI by location (pantry / fridge / freezer)
- [ ] Quick-add from canonical ingredient search
- [ ] Subtract pantry stock during list generation, shown as an explicit offset
      line ("need 12 oz — 4 oz in pantry = buy 8 oz")
- [ ] Toggle to disable pantry offset per list

## Slice 12 — Receipts & Trips
- [ ] Migration: `grocery_trip`, `trip_line_item`
- [ ] Edge Function `parse-receipt` using Claude vision
- [ ] Receipt capture → parsed lines → match to canonical ingredients
- [ ] Review screen, then write `price_record` rows and `actual_price_cents`
- [ ] Trip log list view
- [ ] Optionally auto-add purchased items to pantry

## Slice 13 — Budget & Analytics
- [ ] `monthly_budget_cents` on household, budget setting UI
- [ ] Planned vs. actual dashboard with variance
- [ ] Cost per recipe, cost per serving
- [ ] End-of-month summary view
- [ ] Category spend breakdown

## Slice 14 — Recipe Metadata & Sharing Utilities
- [ ] Dietary tags, allergens, substitution notes
- [ ] Copy week / copy month
- [ ] Export list to print-friendly view, PDF, and plain text
- [ ] Share list as text

---

# V3 — Native, Notified, Paid

## Slice 15 — Capacitor Shells
- [ ] Add Capacitor, generate iOS and Android projects
- [ ] Native camera plugin replaces the web camera path
- [ ] Native storage check — verify IndexedDB persistence inside the WebView
- [ ] Splash screens, icons, status bar, safe-area handling
- [ ] Deep links
- [ ] Test offline behavior inside the native shell specifically

## Slice 16 — Notifications
- [ ] Local notifications: shopping day, prep reminders, expiration alerts
- [ ] Per-household notification preferences
- [ ] Batched, never nagging — cap frequency

## Slice 17 — Monetization
- [ ] RevenueCat SDK, entitlement definitions
- [ ] `useEntitlement()` hook and a single `isPremium` source of truth
- [ ] Free tier limits enforced server-side, not just in the UI
- [ ] Paywall screens at natural friction points
- [ ] Stripe checkout on web, IAP on native
- [ ] Restore purchases flow
- [ ] Grandfather early users onto premium permanently (they earned it)

## Slice 18 — Waste & Trends
- [ ] Migration: `waste_log`
- [ ] Waste logging with auto-estimated cost
- [ ] Monthly waste cost summary
- [ ] Price history charts per ingredient
- [ ] Store price comparison view
- [ ] Leftover utilization rate

## Slice 19 — Store Submission
- [ ] App Store Connect and Play Console setup
- [ ] Privacy policy, data safety disclosures, App Privacy labels
- [ ] Screenshots, listing copy, demo account for reviewers
- [ ] Submit, respond to review feedback (budget two rejection cycles for iOS)

---

## Slice checklist template

Copy this into each PR:

```
- [ ] Migration written + RLS policy added
- [ ] Zod schema updated (shared client/server)
- [ ] Service/engine logic with unit tests
- [ ] UI built, mobile viewport verified
- [ ] Loading, empty, and error states
- [ ] Offline behavior considered
- [ ] Realtime sync verified with two sessions
- [ ] E2E test for the happy path
- [ ] CHANGELOG updated
```
