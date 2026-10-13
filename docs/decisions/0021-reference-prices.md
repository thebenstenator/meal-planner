# 0021 — Reference prices: costs from day one, marked EST

Status: accepted · Date: 2026-10-13 · Builds on: 0008, 0012

Costs used to need the household to set up a store and price each ingredient
first. Until then, recipes, the forecast, auto-fill's budget and cheaper swaps
were all blank. Now every shared ingredient has a **reference price**: a
typical US supermarket price for one typical package. Costs work from a new
household's first recipe.

## Data

`reference_price` holds one row per global canonical ingredient: price,
package (the ingredient's usual package size), `region` ('US') and `as_of`.
It's shared, read-only reference data seeded by migration. The 542 seed
prices were written in one reviewed batch, using no per-household AI and so
free for everyone, consistent with "only AI features are paid". A generator
validated each row against the conversion rules before writing the
migration. Count units don't convert between each other, so a count
ingredient's reference package uses its own default unit: garlic is priced
per clove (10 for $0.69), celery per stalk (9 for $2.29). A price that
couldn't apply fails generation rather than shipping silently. To refresh,
add a migration with a newer `as_of`; the seed upserts.

## Resolution: real prices always win

`useEffectivePrices` is now the single price source behind both costing hooks
(`usePriceIndex` for recipes, planner, forecast, auto-fill and swaps;
`useListPricing` for lists). For each ingredient it uses:

1. the household's **default-store price**, if it has one;
2. otherwise the **reference price, scaled by calibration**, tagged
   `source: 'reference'`.

**Calibration** (`computeCalibration`) learns how a household's real prices
compare with the reference. It takes the median, over items the household has
priced itself, of its unit price ÷ the reference unit price. It applies once
there are 5 such items and is clamped to ×0.6–×1.6, so one odd entry can't
swing everything. "My store runs ~12% over" then corrects every estimate, not
just the items priced.

Staleness stays a store-price concept. The reference has an as-of date
instead.

## EST

Anything priced from the reference shows **EST** in front of the amount:
list items and the projected total, the recipe cost card, cost tags in the
library and picker, planner meal chips, and cheaper-swap savings. Each says
what it means: typical US prices, set your store's for exact figures. The
list's old lowercase "est" suffix (an estimate from the household's *own*
price) is gone. A plain figure is now your price, "paid" is what you paid,
and EST is ours. `hasPrice` still means "has a store price", so the "set a
price" action stays available for reference-priced items.

## Not in scope (yet)

- **AI estimates for household-created ingredients** (about 40% of all
  canonicals) would be a paid feature, per the app's rule that anything
  using AI is paid. Until then those ingredients show as unpriced, as before.
- **Regional pricing.** Calibration is the regional adjustment.
- **Density gaps.** Some jarred and canned goods (salsa, applesauce, canned
  soups) are sized by weight with no density, so a recipe's "1 cup" of them
  can't be priced. That's a canonical-facts fix, separate from prices.
