# 06 — Roadmap

Four releases. Each one is independently shippable and independently useful.
Do not start a version until the previous one is deployed and used by real people.

---

## V1 — MVP: "The list is right, and it has a price on it"

**Goal:** prove the core differentiator works. Ship to the friend and a handful
of other households. Free, no paywall, no app stores.

**Scope**

- Auth, household creation, invite a partner
- Recipe library: manual entry with structured ingredient rows
- **Recipe photo import (multi-page) via AI, with a mandatory review screen**
- Monthly + weekly planner: mains, sides, desserts, snacks, leftovers, eating out
- **Consolidated shopping list generation from any date range**
- **Ingredient engine: parse → match → convert → consolidate → round**
- Unresolved-merge review flow
- Manual price entry per item per store, with staleness indicator
- Projected cost for the generated list
- Aisle grouping, check-off, ad-hoc items
- Installable PWA, offline-capable, realtime household sync

**Explicitly out of scope for V1:** pantry, waste, receipts, budget variance,
analytics, notifications, native apps, payments.

**Done when:** a household plans a full month, generates one list, and the
consolidated quantities and total cost are correct enough that they'd actually
shop from it. That's the bar.

---

## V2 — "The spreadsheet layer"

**Goal:** deliver the analysis features that made a spreadsheet tempting in the
first place, plus close the pricing loop so prices stay fresh without manual work.

**Scope**

- **Receipt photo → AI parse → auto-update prices** (this is how prices stay
  current without any store API)
- Grocery trip log (date, store, total, linked list)
- Pantry / fridge / freezer inventory
- Subtract pantry stock from generated lists
- Auto-add purchased items to pantry on trip completion
- Monthly budget setting + **planned vs. actual variance**
- Cost per recipe, cost per serving
- End-of-month summary (spent, variance, priciest meals, most-cooked recipe)
- Recipe scaling with servings override
- Dietary tags, allergens, substitution notes
- Copy week / copy month
- Export, print, share-as-text

**Done when:** a household can answer "did we stay on budget, and where did the
money go?" without opening a spreadsheet.

---

## V3 — "Native, notified, and paid"

**Goal:** app store presence and the first revenue. Only start this if V1/V2 have
real retained users.

**Scope**

- Capacitor shells for iOS and Android
- Native camera, native local notifications
- App Store and Play Store submission (see `09-risks.md` for Apple review notes)
- RevenueCat integration: entitlements, paywall, web Stripe + native IAP
- Free tier limits enforced (see `08-monetization.md`)
- Notifications: shopping day, prep reminders, expiration alerts
- Waste log with estimated cost, leftover utilization rate
- Price history and per-item trend charts
- Store price comparison
- Recipe notes and ratings, times-cooked, "haven't made in a while"
- Meal-type balance summary
- Split list by store

**Done when:** the app is downloadable on both stores and someone who isn't a
friend has paid for premium.

---

## Backlog — not scheduled

Kept here so they don't creep into earlier versions.

- Recipe import from URL (schema.org JSON-LD parsing)
- Recipe sharing between households — **blocked pending copyright review**
- Public/community recipe library
- Grocery delivery handoff formatting (Instacart, Walmart pickup)
- Voice/assistant quick-add ("add rice to the Walmart list") — shelved until
  after launch. Core is one authed `quick-add` Edge Function reusing
  `addSmartItem` + list-by-name; each assistant is just a front door onto it.
  Feasibility differs sharply: a **Siri Shortcut + HTTP** is the fastest path and
  needs no native app; a **custom Alexa skill** is the fullest voice experience
  (needs OAuth account linking). **Google Assistant is not viable as asked** —
  Google shut down third-party Conversational Actions in 2023, so it now requires
  native Android App Actions and is therefore gated on the V3 Capacitor shell.
  The hard part is identity/account-linking, not the language parsing.
- "Use it up" suggestions from expiring pantry items
- Plan templates
- Nutrition data
- Barcode scanning for pantry entry
- Per-member permissions beyond owner/member
- Multi-currency / international units as a first-class concern

---

## Sequencing principles

1. **Ship V1 narrow.** The temptation is to build pantry and waste tracking early
   because they're fun and easy. They're also worthless if the shopping list is
   wrong. Consolidation correctness comes first.
2. **Don't build analytics before there's data.** Price trends need three months
   of price records to say anything. That's why they're V3, not V2.
3. **Monetize after retention, not before.** A paywall on an app nobody has used
   for two months is a bad experiment.
4. **The web PWA stays a first-class citizen forever.** Native shells are a
   distribution channel, not a replacement.
