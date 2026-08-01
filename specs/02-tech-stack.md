# 02 — Tech Stack

These choices are made for what the product needs, not for developer familiarity.
Where a choice diverges from a "default MERN" instinct, the reason is stated.

## Summary

| Layer | Choice |
|---|---|
| Language | TypeScript (strict) everywhere |
| Client | React 19 + Vite |
| Routing | TanStack Router |
| Server state | TanStack Query |
| Client state | Zustand |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix primitives) |
| Forms | React Hook Form + Zod |
| Database | **PostgreSQL** (via Supabase) |
| Auth | Supabase Auth |
| Realtime sync | Supabase Realtime |
| File storage | Supabase Storage |
| Server logic | Supabase Edge Functions (Deno) |
| Offline store | Dexie (IndexedDB) |
| Service worker | vite-plugin-pwa (Workbox) |
| AI parsing | Anthropic Claude API (vision + structured output) |
| Mobile shell | Capacitor |
| Payments | RevenueCat (wraps Stripe + App Store + Play Billing) |
| Hosting (web) | Vercel |
| Analytics | PostHog |
| Errors | Sentry |
| Unit tests | Vitest |
| E2E tests | Playwright |
| CI | GitHub Actions |

---

## Why Postgres and not MongoDB

This is the most important stack decision and it goes against the default instinct.

The data here is **deeply relational**:

- A recipe has many ingredient lines
- Each ingredient line points at a *canonical ingredient*
- A canonical ingredient has many price records, one per store
- A plan entry points at a recipe and a date and a meal slot
- A shopping list item aggregates *many* ingredient lines across *many* recipes

The core feature — consolidation — is fundamentally a `GROUP BY canonical_ingredient_id`
with unit conversion and summation across joined tables. That is a relational query.
Doing it in MongoDB means either denormalizing heavily (and fighting consistency bugs
when a canonical ingredient is renamed or merged) or writing complex aggregation
pipelines that reimplement joins badly.

Additional Postgres wins here:
- Real transactions when generating a list from many recipes at once
- `CHECK` constraints and foreign keys that make bad ingredient data impossible
- `pg_trgm` fuzzy text search for ingredient name matching — a built-in solution
  to a core problem
- Row Level Security for household data isolation, enforced at the database layer
  rather than in application code

**Decision: PostgreSQL. Not negotiable.**

## Why Supabase

Solo developer, and the app needs auth + realtime multiplayer + file storage +
row-level access control on day one. Building those by hand costs weeks and is
where security bugs live.

Supabase gives all of it on top of plain Postgres, so there's no proprietary
data model lock-in — worst case, the database is exportable and portable.

Row Level Security handles household isolation declaratively: every table carries
`household_id`, and one policy per table ensures a user only ever sees their own
household's rows. This is far safer than checking permissions in route handlers.

**Edge Functions** exist for one specific reason: the Anthropic API key must never
reach the client. All AI parsing calls go through an Edge Function.

## Why Vite + React (not Next.js)

Next.js is excellent, but this app is:
- Behind auth (no SEO value for the app itself)
- Offline-first (server rendering fights the service worker)
- Destined for Capacitor (which wants a static client bundle)

A Vite SPA produces a clean static build that deploys to Vercel as a web PWA and
drops into Capacitor unchanged. A separate marketing/landing site can be Next.js
or plain static HTML later — keep it out of this repo.

## Why Capacitor (not React Native, not a TWA)

- Same codebase ships as web PWA, iOS app, and Android app
- Gives native camera access — important, because recipe/receipt photo capture is
  a headline feature and browser camera APIs on iOS are limited
- Gives real push/local notifications on iOS, which PWAs on iOS still handle poorly
- Android could use a Trusted Web Activity instead, but Apple doesn't support TWAs
  and rejects apps that are "just a website" — so a native shell is required for iOS
  anyway. Use one approach for both.

React Native would mean rewriting the UI and maintaining two codebases. Not worth it.

## Why RevenueCat

Apple requires in-app purchase for digital goods sold inside an iOS app, Google
requires Play Billing, and the web version needs Stripe. That's three payment
integrations and three subscription state machines.

RevenueCat wraps all three behind one entitlement check (`isPremium`), works with
both one-time purchases and subscriptions, and has a generous free tier. This
directly de-risks the undecided monetization model — see `08-monetization.md`.

## Why Claude API for parsing

Recipe OCR and receipt parsing both need: read an image, understand messy
real-world layout, return strict JSON. A vision-capable LLM with structured output
does this far better than Tesseract + regex, and better than a generic OCR service
that returns unstructured text you then have to parse anyway.

Use vision models for both recipe photos and receipts. Prompt for JSON only,
validate the response with Zod, never trust it raw.

## Key libraries

- `convert-units` or a hand-rolled conversion table for unit math
  (see `05-ingredient-engine.md` — generic converters can't do volume→weight)
- `date-fns` for all date math. No moment, no raw Date arithmetic.
- `dexie` + `dexie-react-hooks` for the offline mirror
- `zod` as the single source of truth for validation — share schemas between
  client, Edge Functions, and AI response validation
- `@tanstack/react-virtual` for long recipe/ingredient lists

## Environments

| Env | Purpose |
|---|---|
| local | Supabase CLI local stack, seeded fixture data |
| staging | Separate Supabase project, deployed on every merge to `main` |
| production | Separate Supabase project, deployed on tagged release |

Never point local development at the production database.
