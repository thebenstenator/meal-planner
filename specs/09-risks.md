# 09 — Risks, Roadblocks & Constraints

Read this before planning any slice. Several of these change design decisions.

---

## 1. Ingredient consolidation does not fully solve

**Risk level: high. This is the product.**

Volume→mass conversion requires per-ingredient density. Count→mass requires
per-ingredient item weight. Vague quantities ("a pinch", "to taste") can't be
summed at all. Two ingredients with the same name can be different products
(canned vs. carton coconut milk).

**Mitigation:** the unresolved path is designed as a feature, not an error state.
Surface it, make the fix two taps, save the fix so it never recurs. Never claim
"perfect automatic consolidation" in marketing — claim "consolidation that learns."

## 2. No usable grocery store APIs

**Confirmed.** Walmart's APIs are partner/seller-gated with no public product-price
endpoint. Costco has no public API at all. Third-party scraping services exist but
are legally gray, break when sites change, and add per-store subscription costs.

**Mitigation:** manual price entry is the V1 design, and receipt OCR (V2) is the
mechanism that keeps prices fresh. This is arguably *better* than scraped data
anyway — real prices vary by store location even within one chain.

**Do not build the product on a scraping dependency.**

## 3. AI cost scales linearly with usage

Every recipe photo and every receipt is a paid vision API call. A single
enthusiastic user importing 200 cookbook recipes in a weekend is a real cost event.

**Mitigation:**
- Log every AI call with household id and estimated cost from V1, day one
- Rate limit per household even in the free-for-everyone period
- Batch ambiguous ingredient lines into one call per recipe, never one per line
- Always attempt the deterministic parser first; only escalate what it can't handle
- Cache aggressively — the same cookbook page parsed twice should hit a cache

## 4. Recipe copyright

Photographing your own cookbook for personal use sits in a defensible place.
Storing OCR'd cookbook text on a server and **redistributing it between users**
does not.

**Constraint:** recipes are private to a household. Recipe sharing stays in the
backlog and does not ship without a real review of the legal position.

Note that ingredient lists alone are generally not copyrightable, but the
instructional text, headnotes, and creative expression are. Any future sharing
feature should account for that distinction.

## 5. Scope creep

The feature list assembled here is genuinely large — OCR, consolidation, planner,
pricing, pantry, waste, budget analytics, realtime multiplayer, native apps,
payments. That's not a side project; it's a product.

**Mitigation:** the vertical slice plan exists precisely to prevent building
everything before shipping anything. **V1 ships without pantry, waste, receipts,
analytics, notifications, native apps, or payments.** Resist adding to V1.

## 6. Competitive response

If this works, Paprika, AnyList, Mealime, or Skylight can add consolidation. They
have the users and the engineering capacity.

**Mitigation:** the moat isn't the feature, it's the combination plus execution
quality — consolidation + real per-item pricing + budget tracking + household
sharing in one place, done well. Also: the household-learned ingredient mappings
and price history accumulate per user and get more valuable over time, which
raises switching cost honestly.

## 7. Apple App Store review

Apple rejects apps that are "just a website in a wrapper." A Capacitor-wrapped
PWA can absolutely pass, but it needs to demonstrate app-like behavior.

**Mitigation:** by the time V3 submission happens, the app has genuine offline
support, native camera use, and local notifications. Lean on all three in the
review notes. Budget for at least one rejection cycle.

## 8. iOS WebView storage edge cases

Capacitor-wrapped apps rely on IndexedDB inside the WebView for offline data.
There have been recurring edge cases around iOS WebView storage persistence and
eviction.

**Mitigation:** test offline persistence inside the native iOS shell specifically
and early (Slice 15), not by assuming parity with Safari PWA behavior. Consider
mirroring critical data to the native filesystem via a Capacitor plugin if
eviction proves to be a real problem.

## 9. Realtime conflict resolution

Two people editing the same plan and the same shopping list, one of them offline
in a grocery store, is the *normal* case here.

**Mitigation:** last-write-wins per field (not per row) is sufficient for this
domain — meal planning conflicts are rare and low-stakes. Show a clear sync
status indicator so users understand what's happening. Do not over-engineer this
into CRDTs unless real usage demands it.

## 10. Data loss is unforgivable here

Family recipes are irreplaceable. A bug that deletes a grandmother's recipe is
not a bug, it's the end of the product's reputation.

**Mitigation:**
- Soft delete with 30-day recovery on recipes
- Keep original uploaded images in Storage even after parsing
- `raw_text` on every ingredient line is never overwritten
- Automated Supabase backups verified by an actual restore test, not just enabled
- Export-all-data feature before V3 launch

## 11. Cold start / empty state

A meal planner with no recipes is useless, and manually entering 30 family
recipes is a wall.

**Mitigation:** AI photo import exists precisely to flatten this. Onboarding
should push toward importing 3–5 recipes immediately, and the seeded canonical
ingredient list means matching works from the first recipe.

## 12. Solo developer bandwidth

This is the quietest risk and the most likely to actually kill the project.

**Mitigation:** ship V1 narrow and get it in front of real households fast. Real
usage will reorder the V2 priorities better than any planning document — including
this one.
