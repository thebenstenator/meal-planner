# 08 — Monetization

**Status: philosophy decided. Gate the AI "smart" features, because they carry
a real per-use cost. Everything else — the entire planning loop, household
sharing, unlimited recipes — is free forever.** The payment *model* (subscription
vs. one-time vs. hybrid) is still open and gets decided later with real usage
data; build the infrastructure so that choice is cheap to make.

Nothing shipped before the paywall lands is gated — early testers get everything
free and are grandfathered permanently.

---

## The tension to hold

The friend who originated this idea explicitly said she's tired of grocery/meal
app subscriptions. That is user research, not an offhand comment. Whatever model
gets chosen, the app has to not feel like the thing she was complaining about.

The resolution: **free users get a genuinely complete product, not a trial.** The
core loop works forever, sharing is free, and there's no recipe cap. We only
charge for the features that cost us money on every use, plus a thin layer of
power-user analytics.

---

## What actually costs money

Only one thing in the app has a real marginal cost per use — **Claude API
calls** — and they already run through one shared per-household meter
(`consume_ai_credit`, see Implementation below):

| Cost | Driver | Notes |
|---|---|---|
| Claude — recipe photo/PDF import (`parse-recipe`) | Per import | Haiku; cheap-ish |
| Claude — URL import (`parse-recipe-url`) | Per import | JSON-LD path is **free**; AI only on fallback |
| Claude — meal ideas (`suggest-meals`) | Per request | Sonnet; the most expensive call |
| Claude — receipt scanning | Per receipt | *Spec'd, not built. Recurring cost.* |
| Supabase (db, storage, bandwidth) | Grows with users + images | Slow, cheap; not a per-action cost |
| Apple Developer / Google Play | $99/yr · $25 once | Fixed |

Everything else — consolidation, the planner, shopping lists, manual pricing,
budget, pantry, **household sharing**, offline/PWA — is **fixed cost**. A user
hammering the planner or inviting their whole family costs us nothing
incremental. That's why none of it is gated.

Household sharing is deliberately free: it's the app's best growth loop. One
invite turns one user into a stickier multi-person household, and a large family
sharing recipes is exactly the pool that converts to the paid AI features. The
more people in a household, the better — never gate it.

---

## Free tier — genuinely complete, forever

- **Unlimited manual recipe entry — no recipe cap**
- Ingredient line autocomplete + canonical matching (no AI)
- Recipe library, search, filter, tags, scaling
- **Full ingredient consolidation** — the core differentiator; never gate this
- Full monthly + weekly planner, all entry kinds, servings override
- Shopping list generation, provenance, aisle grouping, check-off
- Offline-first operation + installable PWA
- One store, manual price entry, projected monthly total
- Budget goal, planned vs. actual, month-over-month spending history
- Manual pantry tracking: buy→stock, cook→stock, running-low, pantry offset,
  bulk paste-import (all no-AI)
- **Household sharing — unlimited members, realtime, free**
- **A monthly taste of AI: 3–5 credits/month** so every free user experiences
  photo import and meal ideas — that firsthand "magic" is what sells the upgrade

## Premium — the smart layer

Premium is the *intelligence and automation* layer on top of the free manual
loop. It splits into three groups. The philosophy is unchanged — we gate the
"smart" stuff — but "smart" is broader than "costs an API call": it's anything
that thinks *for* the user. Some of it has a real AI cost; some of it costs us
nothing but is the ambient, recurring value that justifies staying subscribed.

**1. The recurring hooks (why someone stays subscribed):**
- **Auto-fill a balanced month** — the flagship. **BUILT (Phase 2).** One tap
  fills the month's **empty** slots with a proposed set of meals that mixes the
  household's **favorites / most-cooked**, recipes they **haven't made in a
  while**, and **fresh AI ideas** for novelty — balanced for variety (no 12
  chicken nights) and seeded from pantry stock. A **novelty dial** (all
  favorites / a few new ~1/wk / lots new ~2–3/wk) controls how much AI is used
  (all-favorites is free — no credit), and a **slot toggle** picks dinner-only
  vs all meals. Always an editable proposal (swap any day to another recipe or
  skip it), never auto-committed (per the "never auto-save AI output"
  principle). One metered credit per generate. This is the "month is the unit"
  promise delivered in one tap, and it's a *monthly ritual* — the single best
  reason to keep a subscription. Code: `src/features/planner/autofill.ts`
  (balancer), `use-autofill.ts`, `components/autofill-panel.tsx`.
- **Meal ideas** (`suggest-meals`) — pantry-aware dinner ideas, saved straight
  to the plan and list. Sell the *integration*, not raw generation (that's the
  moat vs. free ChatGPT).
- **Receipt scanning → automatic price updates** — removes the one recurring
  tedious step in keeping prices honest. *Not built yet; highest-value thing to
  build (see below).*
- **Smart reminders & surfacing** (zero AI cost): shopping-day and prep
  reminders ("thaw the chicken tonight"), expiration alerts, "haven't made this
  in a while," use-it-up suggestions, meal-type balance nudges. Individually
  small; together they're the ambient weekly value that a one-time unlock can't
  replicate.

**2. Unlimited AI (the cost-recovery gate):**
- **Unlimited (or high-cap) AI**: recipe photo/PDF/URL import + meal ideas +
  auto-fill + receipt scanning, all drawing on the same metered credit pool.

**3. Power-user analytics (bonus, not the pitch):**
- Multiple stores + price comparison
- Price history / trends per item, month-over-month store comparison
- Export / print / share-as-text

---

## Conversion strength & build priority

The gated tier has to actually drive sales. The honest read:

- **Recipe import is front-loaded** — people import their collection once, then
  rarely. Great onboarding spike (hit the free-AI wall at peak motivation), weak
  retention. Perfect for a one-time unlock, dangerous to lean a subscription on.
- **The recurring hooks are what make a *subscription* honest.** In order of
  pull: **auto-fill a balanced month** (monthly ritual), **receipt scanning**
  (recurring, removes tedium), **meal ideas** (weekly), **smart reminders**
  (ambient). Analytics barely moves anyone.

**Build priority for monetization:**
1. ✅ `useEntitlement()` + tier the AI limit (Phase 0) — plumbing everything needs.
2. ✅ **Auto-fill a balanced month** (Phase 2) — the flagship recurring hook,
   composing features already built (planner, suggest-meals, cook stats).
3. **Receipt scanning** — *next.* The feature that decides whether this is a
   subscription business or a one-time-unlock business.
4. Smart reminders / surfacing — cheap, recurring, ships incrementally.

(Phase 1 = favorites + auto-maintained cook stats, the ranking signals auto-fill
needs. Payment rails deferred — everyone grandfathered to premium during testing
via `household.is_premium` default true.)

Rule of thumb tying this to the model question: if the paid tier stays mostly
front-loaded AI import, price it as a **one-time unlock**. The more of the
recurring smart layer (auto-fill, receipts, reminders) actually ships, the more
a **subscription** is justified. Build toward the recurring layer so the hybrid
paywall has something real behind both options.

---

## Payment model — still open

The tier split above holds regardless of which of these is chosen. Decide the
model with real data once there are paying users.

### Option A — Subscription
Suggested: **$3.99/month or $29.99/year** (annual is the real product; monthly
exists to make annual look good).
- Pro: aligns revenue with ongoing AI cost; funds development; store-standard.
- Con: collides directly with the stated user complaint; churn.

### Option B — One-time purchase
Suggested: **$29.99–$39.99 lifetime unlock.**
- Pro: exactly what the originating user wants; strong differentiator in a
  subscription-saturated category ("no subscription, ever").
- Con: no recurring revenue against recurring AI cost. **Must meter AI even for
  paid users** — e.g. lifetime unlock includes 30 AI ops/month with a small
  credit-pack top-up for heavy months. The metering infra already exists, so
  this is a config change, not a build.

### Option C — Hybrid (recommended default)
Offer **both** at checkout: a monthly/annual subscription *and* a lifetime unlock
priced at ~12–18 months of the annual plan.
- Pro: users self-select; captures subscription-averse buyers without giving up
  recurring revenue; RevenueCat supports both natively.
- Con: slightly more complex paywall UI.
- Bonus: the split tells you empirically which model to lean into.

**Recommendation: build Option C.** Same integration work, resolves the open
question with data, and respects the friend's preference without abandoning
sustainable economics.

---

## Store policy constraints

- Apple requires **In-App Purchase** for digital goods sold within an iOS app;
  you can't link out to a cheaper web checkout inside the app (rules have shifted
  — verify before submission).
- Google requires Play Billing under the same logic.
- Apple/Google each take a cut (15% under small-business thresholds, 30% above).
  Price accordingly.
- Web purchases via Stripe avoid the cut — steer users toward web checkout
  *outside* the app (e.g. onboarding emails).

RevenueCat exists to make one entitlement work across all three payment rails.
Use it rather than hand-rolling.

---

## Implementation

**Already built (the cost gate is mostly done):**
- `ai_usage_counter` table — one row per household per month.
- `consume_ai_credit(household_id, limit)` RPC — atomic, `SECURITY DEFINER`,
  enforced server-side inside all three AI edge functions via the caller's JWT.
  Returns remaining credits, or `-1` when over the cap; the function refuses to
  call Claude when over.
- A single `AI_MONTHLY_LIMIT` env (default 50) shared by every AI function.

**Still to build:**
- **`useEntitlement()` → `{ isPremium }`, one source of truth.** No plan check
  exists anywhere yet. Never scatter `isPremium` through components; both the AI
  limit and the soft-gated analytics UI read from this one hook.
- **Tier the AI limit off entitlement**, not a single env: free = 3–5,
  premium = high/unlimited. Pass the resolved cap into `consume_ai_credit` from
  the edge function based on the household's entitlement, so the meter enforces
  the free-vs-paid split server-side. A client `isPremium` is a suggestion, not a
  control.
- **Soft-gate the power-user UI** (multi-store comparison, price history/trends,
  export) behind the same hook — these have no server cost, so a UI gate + a
  paywall prompt is enough.
- **Paywall at moments of demonstrated value** — after generating a list, when
  the free AI allowance runs out, when viewing a locked analytics screen. Never
  on first launch.
- **RevenueCat** for the entitlement across web (Stripe) / iOS / Android.
- **Log every AI call** with household id and a cost estimate from day one. The
  counter gives counts; add enough to reconstruct spend, or the pricing decision
  is a guess.
- **Grandfather every pre-monetization user permanently.** They tested it for
  free; that's worth more than their subscription.
