# Changelog

All notable changes to this project are documented here. One entry per slice
(see `specs/07-vertical-slices.md`).

## [Unreleased]

### Shopping list categories (store sections)

- Lists are grouped into **store sections** — Produce, Bakery, Meat, Dairy &
  eggs, Frozen, Pantry, Baking, Household… — in the order you walk the store,
  on both the list page and the compact panel on the shopping-list index.
- **Anything you add is filed automatically.** The category comes from the
  matched ingredient, else a keyword guess from the name ("paper towels" →
  Household, "frozen peas" → Frozen, "canned tuna" → Canned goods), else
  **Other**. Ad-hoc items used to land in "other" unconditionally.
- **Categories are yours:** a "Categories" panel on the list page renames them,
  reorders them to match your store, adds your own ("Bulk bins"), and deletes the
  ones you don't use — deleted sections move their items to Other rather than
  losing them. "Other" itself can be renamed but not deleted.
- **Move an item, and it sticks:** "edit" on a row has a category picker (with
  "+ New category…" inline). For an item backed by a real ingredient the choice
  is remembered for the household — including for global seed ingredients — so
  the same item lands there next time and **survives regenerating the list**.
- New `shopping_category` + `household_ingredient_category` tables with RLS; every
  household (existing ones too) is seeded with the 17 default sections. Pure
  helpers with unit tests (grouping, ordering, slugs, deduction); e2e covers
  filing, recategorizing and managing categories. See
  `docs/decisions/0014-shopping-categories.md`.

### Bulk recipe import (no AI credits)

- New **Bulk import** page (Recipes → Bulk): add many recipes at once, free.
  - **Paste text / upload files:** paste one or more recipes (separated by a
    `---` line) or upload `.txt`/`.md` files. A deterministic parser pulls out
    title, ingredients (via the engine + trigram matcher), and instructions —
    "Ingredients"/"Directions" headers when present, else a heuristic split.
  - **Recipe links:** paste a list of URLs; each is imported via the site's
    schema.org data only (`jsonLdOnly` on `parse-recipe-url` — **never falls back
    to Claude**, so no credits). Links without structured data are skipped and
    listed.
  - A review list shows each parsed recipe (ingredient count, how many still need
    matching); untick any, then save them all. Unmatched ingredients still save —
    fixable per recipe later.
  - Pure parser helpers with unit tests; e2e for the text path.
  - **PDF files (digital/text):** upload `.pdf` files too — the text layer is
    extracted **in the browser with pdf.js (no AI)**, then parsed like any other
    text. Image-only/scanned PDFs (no text layer) are detected and listed as
    "unreadable" (those still need the AI photo import). pdf.js loads lazily, only
    when a PDF is processed. e2e extracts a generated text PDF and imports it.
  - **Note:** the URL bulk mode needs `supabase functions deploy parse-recipe-url`
    (adds the `jsonLdOnly` mode). The text/file/PDF modes need no deploy.

### Pantry: bulk import from a pasted list (no AI)

- A "Bulk add from a list" box on the Pantry page: paste your inventory (one item
  per line, or spreadsheet columns — tab/comma separated), and each row is parsed
  and matched to a canonical ingredient with the engine + trigram matcher —
  **no AI credits**. A preview lets you fix any misses (per-row match + qty/unit)
  and pick a location, then add all matched rows in one go. Pure `parsePantryLine`
  helper (5 unit tests); e2e paste → preview → add.

### Slice 10 — Recipe scaling (UI)

- **Recipe page:** a "Scale to N servings" stepper that recomputes and shows each
  ingredient's scaled amount inline ("2 cups flour → 2.5 cup"), with a reset.
  Pure display; the stored recipe is unchanged. Pure `scaledAmount` helper
  (6 unit tests, fractional + rounding).
- **Planner:** an optional "Servings" field when adding a recipe to a slot sets
  the meal's `servings_override` (one-click add still works — blank = the recipe
  default). The chip shows the override ("6sv"), and it already flows through
  consolidation and cost scaling. e2e covers both.

### Editable name (avatar initials)

- Household settings gains a **"Your name"** card. Setting it updates your auth
  profile (`full_name`) so the avatar initials and account menu update live — no
  reload. Fills the gap for accounts created before signup collected a name
  (their avatar was falling back to email initials). e2e covers it.

### Fix: planner crash after reload (persisted `Map` cache)

- The planner (and list/recipe costing) crashed with `n.forEach is not a
  function` after a reload. Cause: two query functions returned `Map`s, which
  JSON-round-trip to `{}` when the query cache is persisted to localStorage
  (Slice 8 offline), so the rehydrated data had no `.forEach`/`.get`.
  `fetchRecipeCostInputs` and `fetchConversionInfos` now return plain arrays,
  with the `Map` built in-memory at the use site. Bumped the persister cache key
  (`…-v2`) so any already-corrupted cache is discarded on next load. e2e: the
  planner survives a reload with a persisted cost cache.

### Signup collects a name; household named after it

- Sign-up now has an optional **"Your name"** field. It's stored as `full_name`
  auth metadata and used to name the auto-created household ("Ben's Household"
  instead of the email-derived "bstenson's Household"). Falls back to the email
  prefix when no name is given. `handle_new_user` reads the metadata.
- The avatar menu shows the name (with email beneath) and derives its initials
  from the name when present.

### Header: primary nav + avatar menu

- The header grew to ~10 flat links as features landed. Now it shows the
  day-to-day destinations (Plan, Ideas, Recipes, Pantry, List) and tucks the
  occasional/settings pages (Spending, Stores, Ingredients, Household settings)
  plus Sign out behind a circular **avatar menu** (initials from your email).
  Dependency-free dropdown (backdrop-close); e2e covers open → navigate → sign out.

### Smart pantry

- **Pantry** page (Phase 1): manual setup — quick-add via the canonical search,
  grouped into pantry/fridge/freezer, inline quantity edits + remove.
  (`pantry_item` table, RLS scoped to members.)
- **Buy → +stock** (Phase 2): checking a matched item off the shopping list adds
  its purchased quantity to the pantry (whole packages when known, else the
  needed amount); un-checking reverses it. Units are converted through the Slice 2
  engine; unmatched/ad-hoc items and unreconcilable units are skipped rather than
  corrupting a row. Best-effort — a pantry write never blocks the check-off.
  e2e: buy 8 oz cream cheese → it appears in the pantry at 8.
- **Cook → −stock** (Phase 3): a "cooked" toggle (🍳 → ✓) on each planned recipe
  meal in the week view. Marking it cooked subtracts the recipe's ingredients
  from the pantry (scaled by any servings override); un-marking adds them back.
  `cooked_at` on `plan_entry` is the idempotent guard. e2e: stock 16 oz cream
  cheese, cook a recipe that uses 8 oz → pantry shows 8.
- **Running low** suggestions: on the shopping list, pantry items below ~10% of a
  typical package (from the canonical's package size; falls back to "out" when
  there's no size) surface in a "Running low" section — one-tap **Add** (drops it
  on the list) or **Dismiss**. Items already on the list are skipped. Dismiss/Add
  mute the suggestion (`restock_muted`) until you buy more, which auto-clears it.
  Pure `isLowStock` helper (6 unit tests) + e2e.
- **Pantry offset on list generation** (Phase 4): generating a list subtracts
  what's already on hand, per item — "need 12 oz − 4 in pantry = buy 8" (shown on
  the row), recomputing the purchase rounding on the reduced amount and dropping
  fully-covered items. A "Subtract what's already in my pantry" toggle (default
  on) on the generate screen. `pantry_offset_quantity` on `shopping_list_item`.
  e2e: 12 oz need − 4 oz on hand → buy 8.
- **Suggest from my pantry**: the Ideas page gets a "Use what's in my pantry"
  shortcut that fills the ingredient box with your pantry contents.

### "What can I make?" — AI dinner ideas from your ingredients

- New **Ideas** page: list what you have (typed, comma/line separated) + optional
  dietary filters → dinner ideas you can cook tonight. Prompt adapted from the
  standalone dinner-ideas app (warm, honest, cuisine variety, treats basic pantry
  staples as free).
- Edge Function `suggest-meals` (Deno): one Claude call, structured JSON, the
  Anthropic key stays server-side, rate-limited per household via the existing
  `consume_ai_credit`. Model is env-configurable (`SUGGEST_MODEL`, default
  `claude-sonnet-4-6` for idea quality; drop to Haiku to cut cost).
- Each idea returns the same shape as URL import (title/servings/times/steps +
  quantified `ingredient_lines`), so **Save as recipe** reuses the recipe-review
  path verbatim (engine parse → canonical match → the recipe form), and each idea
  reports what it **uses** and what's **missing**.
- **Add missing to list**: an idea's missing non-staple ingredients drop into your
  newest shopping list (or a new week list) in one tap.
- Built to accept the pantry as an ingredient source once that lands.

### Budget & meal costing (consumption-based)

- **Recipe cost**: each recipe now shows an estimated cost and cost-per-serving,
  computed from the amount it actually *uses* — 2 oz of a $3.00 / 15 oz bottle of
  soy sauce is $0.40, not a whole bottle. This is distinct from the shopping
  list's purchase-based projected total (whole packages), so per-meal numbers are
  comparable and don't over-count pantry staples. Unmatched/unpriced ingredients
  are flagged, and recipes fall back to a "set up pricing" nudge when there's no
  default store or prices.
- **Monthly budget goal**: owners can set a household monthly grocery budget in
  Household settings (the `monthly_budget_cents` column existed but was unused).
- **Planner budget rollup**: a summary bar shows projected consumption spend for
  the calendar month vs. the budget goal, with an over/under variance and a
  progress bar. Each planned meal in the week view shows its own cost (scaled by
  any servings override); non-recipe entries (leftovers/eating out) cost nothing.
- Pure, unit-tested `consumptionCost`/`recipeCost` (9 tests); cost hooks reuse the
  existing store/price/conversion infrastructure.
- **Planned vs. actual**: the planner budget bar now tracks **actual spend** —
  purchase cost of checked-off shopping items on lists overlapping the month —
  against the budget goal (with planned consumption cost shown as a forward
  estimate). The shopping list shows a running **Spent** total beside the
  projected total. Each planner meal also shows its **per-serving** cost.
- e2e: price 8 oz cream cheese at $2.50 → the recipe's estimated cost reads $2.50.
- **Month-over-month spending**: a new **Spending** page charts actual grocery
  spend for the last 6 months (checked-off items, attributed to each list's
  month) with the budget goal drawn as a threshold line, plus a per-month
  breakdown with over/under variance.
- **Actual price at check-off** (`actual_cost_cents` on `shopping_list_item`):
  check-off stays one tap; every item's price is now tap-to-edit to record what
  you actually paid — including manual/ad-hoc items and items with no estimate
  (an "add price" affordance). When set it overrides the estimate everywhere
  spend is summed (list "Spent", planner budget bar, spending history); blank
  reverts to the estimate. Optimistic like check-off, so it never flickers. The
  reusable canonical/estimate price is now a distinct, secondary "set an estimate
  price" control so the two don't look alike. e2e covers both, incl. pricing a
  manual item.

### Ingredients — bigger catalog + easier matching

- Seeded **370 more global canonical ingredients** (172 → 542): more meat/poultry
  cuts, seafood, produce, beans/legumes, pasta/grains/noodles, dairy/cheeses,
  spices, condiments, nuts, bakery, frozen, breakfast, snacks, and beverages —
  each with aliases, aisle category, default unit, and typical package size.
  Deduplicated against the original seed, with alias collisions resolved so
  matches stay deterministic.
- Ingredient editor: an unmatched row's "Match to ingredient…" box now
  **pre-fills with the parsed ingredient name**, so matching or creating a new
  ingredient inline is one tap (no re-typing, no leaving the recipe form). The
  create-on-the-fly path already existed; this makes it discoverable and fast.

### Slice 9 — AI Recipe Import

- Supabase Edge Function `parse-recipe` (Deno): sends recipe photos (one recipe,
  multi-page) to Claude vision and returns strict JSON constrained by a JSON
  schema (`output_config.format`), validated with Zod and retried once. The
  Anthropic API key never leaves the server. Model is env-configurable
  (`RECIPE_PARSE_MODEL`, default `claude-haiku-4-5`).
- Per-household monthly rate limiting: `ai_usage_counter` + `consume_ai_credit`
  RPC, enforced in the function via the caller's JWT (cost control).
- Import UI: multi-image capture (add page 1, page 2, …), parse, then a
  **mandatory review screen** — the parsed recipe opens in the recipe form with
  each ingredient matched to a canonical one and low-confidence / unmatched rows
  highlighted; nothing saves until the user confirms.
- Graceful failure: a parse error or hit limit falls back to manual entry.
- **PDF import**: the same `parse-recipe` function accepts a PDF as a Claude
  document block (branching on `media_type`), so a recipe can be imported from a
  PDF as well as photos. The import UI accepts `application/pdf`.
- **Website import**: a new `parse-recipe-url` Edge Function fetches the page
  server-side (bypassing browser CORS). The fast path reads schema.org/Recipe
  JSON-LD with **no AI call** (free); pages without usable JSON-LD fall back to
  Claude on the page text (consumes a credit). Either way it returns raw
  ingredient lines, which the client runs through the same Slice 2 engine parser
  + Slice 3 matcher as paste-to-parse, into the same mandatory review screen.
  The import page now leads with a URL field.

### Slice 8 — Offline & PWA

- Offline-first via TanStack Query's built-in machinery instead of a hand-rolled
  Dexie store: the query cache is persisted to localStorage
  (`PersistQueryClientProvider`), so the active shopping list, recipes, and plan
  are readable offline and survive a reload. Persisted cache is cleared on
  sign-out.
- Offline writes: mutations made while offline are queued (paused) and replay
  automatically on reconnect. Check-off is optimistic and applied synchronously
  so it never flickers, and it survives the offline queue.
- Visible sync status in the header (Offline · N queued / Syncing…) and an
  install prompt (`beforeinstallprompt`).
- PWA: manifest icons, `navigateFallback` to the SPA shell for offline deep
  links, and outdated-cache cleanup.
- e2e: go offline, check off an item, reconnect → it replays and persists
  (verified by reload).

### Slice 7 — Stores & Pricing

- Migration: `store` and append-only `price_record` (never update a price —
  insert a new record) with RLS (price records are insert+read only). Wires the
  `household.default_store_id` FK and adds a configurable `price_stale_days`.
  `get_current_prices` RPC returns the most recent record per canonical per store.
- Stores page: add/delete stores, set the default, set the staleness threshold,
  and a "prices at your default store" review list with stale flags.
- Pricing math (pure, unit-tested): cost is charged on the **purchased** quantity
  — rounded up to whole store packages — and converts units via the engine
  before pricing.
- Shopping list: a **projected total** with an explicit unpriced count and stale
  count, per-item estimated cost, an inline "no price yet — add one" / "update
  price" flow (package price + size, not unit price), and stale badges.
- e2e: add a store, price 12 oz cream cheese at $2.50 / 8 oz → projected $5.00.

### Slice 6 — Shopping List Generation (the payoff)

- Migration: `shopping_list`, `shopping_list_item` (the money table),
  `shopping_list_item_source` (provenance), with RLS. `generate_shopping_list`
  RPC persists engine-consolidated items atomically, preserves `is_checked` on
  regenerate, and keeps manually-added items (`is_manual`) across regeneration.
- Generation reuses the pure Slice 2 engine client-side: a date range → plan
  entries (recipe kind only; leftovers/eating_out/note excluded) → recipe
  ingredients → consolidate → persisted list. Unmatched ingredients consolidate
  too via synthetic keys and are flagged.
- List UI: generate flow (date range), aisle/category grouping, purchase
  rounding, expandable provenance ("why?"), optimistic check-off, regenerate.
- Unresolved-merge review: [Set conversion] (writes a density back to the
  canonical ingredient, then regenerates to merge) / [Keep separate].
- Ad-hoc items (survive regeneration), manual quantity override, and item delete.
- e2e: two recipes (8 oz + 4 oz cream cheese) → one 12 oz line → buy 2 × 8 oz,
  with provenance; an ad-hoc item persists across regenerate.

### Slice 5 — Planner

- Migration: `plan_entry` (day + slot + kind: recipe/leftovers/eating_out/note)
  with RLS, a check that recipe entries point at a recipe (and others don't),
  added to the `supabase_realtime` publication with `REPLICA IDENTITY FULL` so
  filtered DELETE events reach subscribers.
- Planner UI: week view (7 day cards × 4 slots) and a month overview grid, with a
  Week/Month toggle, prev/next navigation, and Today. Tapping a month day opens
  that week.
- Add any entry kind to a slot (recipe via search, leftovers, eating out, note),
  multiple per slot, move an entry to another day/slot (tap-to-move), and remove.
- **Realtime sync**: a `plan_entry` subscription invalidates the plan queries so a
  partner's edits appear live. Realtime auth is set from the session so RLS
  filters what each client receives.
- Pure date helpers (month-grid/week ranges) with unit tests; two-session e2e
  verifying an entry added on one device appears and is removed on the other live.

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
