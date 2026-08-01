# 08 — Monetization

**Status: undecided between one-time purchase and subscription. Build the
infrastructure so the decision can be made later with real data.**

Implementation happens in V3 (Slice 17). Nothing in V1 or V2 should be gated —
early users get everything free and are grandfathered permanently.

---

## The tension to hold

The friend who originated this idea explicitly said she's tired of grocery/meal
app subscriptions. That is user research, not an offhand comment. Whatever model
gets chosen, the app has to not feel like the thing she was complaining about.

At the same time, this app has **real recurring costs per user**:

| Cost | Driver |
|---|---|
| Claude API — recipe parsing | Per photo imported |
| Claude API — receipt parsing | Per receipt, ongoing and recurring |
| Supabase (database, storage, bandwidth) | Grows with users and images |
| Apple Developer | $99/year |
| Google Play | $25 one-time |
| RevenueCat | Free below a revenue threshold |

A pure one-time purchase against an ongoing AI cost is a structural mismatch —
a heavy user could easily cost more in API calls over three years than they paid
once. That doesn't kill the one-time model, but it means AI usage has to be
metered under it.

---

## Free tier (the shape, regardless of model)

The free tier must be **genuinely usable forever**, not a crippled trial. The core
differentiator — consolidation — should be free, because that's what earns
word of mouth.

**Free includes:**
- Unlimited manual recipe entry
- Up to ~25 stored recipes
- Full monthly planner
- **Full ingredient consolidation** — never gate this
- One store, manual price entry
- Shopping list generation and check-off
- Single user (no household sharing)
- 3 AI recipe photo imports per month

**Premium adds:**
- Unlimited recipes
- Unlimited AI recipe imports
- Receipt scanning → automatic price updates
- Multiple stores and price comparison
- Household sharing (multiple members)
- Pantry and waste tracking
- Budget tracking, variance, and all analytics
- Export and print
- Price history and trends

The three highest-value premium hooks, in order: **household sharing**,
**receipt scanning**, **budget analytics**. Sharing is the one people will pay
for fastest, because meal planning is usually a two-person activity.

---

## Model options

### Option A — Subscription
Suggested: **$3.99/month or $29.99/year** (annual is the real product; monthly
exists to make annual look good).

- Pro: aligns revenue with ongoing AI and infra costs; funds continued development;
  standard for app store distribution
- Con: directly collides with the stated user complaint; higher churn; needs
  continuous perceived value

### Option B — One-time purchase
Suggested: **$29.99–$39.99 lifetime unlock.**

- Pro: exactly what the originating user wants; strong differentiator in a
  subscription-saturated category; simpler to market ("no subscription, ever")
- Con: no recurring revenue against recurring costs; requires metering AI usage
  even for paid users; revenue is front-loaded and flattens

**If choosing this, meter AI:** lifetime unlock includes e.g. 30 AI operations
per month, with a small credit pack purchase for heavy months. This keeps the
"no subscription" promise honest while covering variable cost.

### Option C — Hybrid (recommended default)
Offer **both** at checkout: a monthly/annual subscription *and* a lifetime unlock
priced at roughly 12–18 months of the annual plan.

- Pro: lets users self-select; captures subscription-averse buyers without giving
  up recurring revenue; RevenueCat supports both natively with no extra work
- Con: slightly more complex paywall UI
- Bonus: the pricing decision gets made by users instead of by guessing, and
  the split tells you which model to lean into later

**Recommendation: build Option C.** It's the same integration work, it resolves
the undecided question empirically, and it respects the friend's stated
preference without abandoning sustainable economics.

---

## Store policy constraints

- Apple requires **In-App Purchase** for digital goods sold within an iOS app.
  You cannot link out to a cheaper web checkout inside the app (rules here have
  shifted; verify current policy before submission).
- Google requires Play Billing under the same logic.
- Apple and Google each take a cut (15% under the small business thresholds,
  30% above). Price with that in mind.
- Web purchases via Stripe avoid the cut entirely — worth steering users toward
  the web checkout *outside* the app, e.g. in onboarding emails.

RevenueCat exists specifically to make one entitlement work across all three
payment rails. Use it rather than hand-rolling.

---

## Implementation notes

- Enforce limits **server-side**. A client-side `isPremium` check is a suggestion,
  not a control.
- One source of truth: `useEntitlement()` returning `isPremium`. Never scatter
  plan checks through components.
- Log every AI call with household id and cost estimate from day one, even in V1.
  Without that data the pricing decision is a guess.
- Build the paywall to appear at moments of demonstrated value (after generating
  a list, when inviting a partner), never on first launch.
- **Grandfather every pre-V3 user permanently.** They tested it for free; that's
  worth more than their subscription.
