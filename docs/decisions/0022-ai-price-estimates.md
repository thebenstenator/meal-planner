# 0022 — AI price estimates (premium)

Status: accepted · Date: 2026-10-13 · Builds on: 0021

Reference prices (0021) cover the 542 shared ingredients. Ingredients a
household creates itself (about 40% of all canonicals) still had no price, so
the recipes and lists that use them stayed partly unpriced. For those, a
premium household can now ask Claude for a typical US price.

## Paid, and only when asked

It calls Claude, so it's premium, per the app's rule that anything using AI is
paid. `estimate-prices` checks `household.is_premium` itself rather than
trusting the UI. It never runs on its own. **"Estimate N missing prices with
AI"** appears on the recipe cost card and in the list summary wherever
ingredients have no price at all. One tap estimates the whole batch (up to 50)
for one metered credit (`consume_ai_credit`, source `estimate-prices`). Free
households see a one-line note about what premium would do.

"Missing" means no price of any kind: not a store price, a reference price or
an earlier estimate. An ingredient that *is* priced but whose recipe unit can't
convert is a density/facts problem, and AI pricing wouldn't fix it.

## Estimates behave like reference prices

The function returns validated estimates and the client stores them in
`household_price_estimate` (per household, RLS members-only; re-estimating
replaces). `useEffectivePrices` merges them in with the reference prices: below
the household's own store price, scaled by the same calibration, and marked
**EST**. Once estimated, an ingredient is priced on every recipe and list
without asking again.

## Guardrails

- **Units are validated server-side** against each ingredient's default unit,
  using the same rule as the converter (mass ↔ mass, volume ↔ volume; count
  units only match themselves). Estimates the app couldn't convert are dropped,
  never stored. Prices are bounded to 0–$1,000.
- **Model:** `claude-opus-5` at low effort with structured JSON output, and the
  server-side refusal fallback (`fallbacks: "default"`) enabled.
  `ESTIMATE_MODEL` overrides the model without a code change. Picking a cheaper
  model is a cost decision for the owner.
- **Tests** stub the function (no Claude call), and cover the estimate being
  saved and reused after a reload without a second request.

## Also in this change: density gaps

173 shared ingredients sized by weight but measured by volume in recipes
("1 tsp paprika", "1 cup shredded cheddar", "1 cup salsa") got a density, so
those amounts can now be priced and merged on lists. The migration only fills
blanks. Meat, fish, doughs and crackers aren't measured by volume and were
left alone.
