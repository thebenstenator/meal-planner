# 0012 — Budget & meal costing (consumption-based)

Status: accepted · Date: 2026-08-05

Builds the second half of the product thesis — plan → shop → *stay on budget* —
on top of Slice 7 pricing. Corresponds to the roadmap's "Slice 13 — Budget &
Analytics".

## Two cost models, kept separate on purpose

The app now has two legitimate notions of cost, and they intentionally don't
reconcile:

- **Purchase-based (shopping list):** `estimateItemCost` rounds up to whole store
  packages — what actually leaves your wallet. Already existed; unchanged.
- **Consumption-based (recipes & meals):** `consumptionCost` charges the *portion
  a recipe uses* — `unitPrice × usedQuantity`, no package rounding. 2 oz of a
  $3.00 / 15 oz bottle = $0.40.

Consumption cost is right for "how much did this meal cost" and for comparing
meals; it won't sum to the shopping total because you buy whole packages and keep
leftovers. We surface consumption cost on recipes and the planner, and note on
each that it's "the amount this recipe uses." We did **not** try to unify the two
numbers — conflating them would make one of the two questions wrong.

## The cost engine is pure and reuses the Slice 2 converter

`recipeCost(ingredients, servings, prices, infos)` sums `consumptionCost` per
ingredient, skipping optional ones (not a committed spend) and counting anything
unmatched / unpriced / unconvertible as "unpriced" rather than guessing. Unit
conversion goes through the same engine `convert` used everywhere else, so a
recipe's "2 oz" prices correctly against a package sized in grams when a density
exists. Pure and unit-tested; the React hooks only fetch prices + facts and call
it.

## Prices come from the default store, shared across recipes

Costing reuses the existing `get_current_prices` RPC, `fetchConversionInfos`, and
pricing settings. `usePriceIndex` loads them once for a set of canonical ids so
the planner can cost many recipes from a single price/store fetch instead of one
per recipe.

## The budget rollup is monthly and consumption-based

The planner's budget bar always reflects the **calendar month** of the anchor
(independent of the week/month toggle), summing the consumption cost of every
recipe meal that month against `household.monthly_budget_cents`. A servings
override scales a meal's cost proportionally. We show projected-vs-goal with an
over/under variance. The column already existed on `household` from Slice 1, so
no migration was needed — just a settings UI and the read.

## No CI e2e yet

The costing math is covered by unit tests and the data path was verified manually
end-to-end (budget write/read, `get_current_prices`, recipe-ingredient fetch, and
the 2 oz → $0.40 calculation). A planner/recipe cost e2e is a reasonable
follow-up but isn't blocking.
