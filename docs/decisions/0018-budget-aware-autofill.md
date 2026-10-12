# 0018 — Budget-aware auto-fill

Status: accepted · Date: 2026-10-12 · Builds on: 0017

Auto-fill (premium) proposes a month of meals. It now also keeps those meals
under a dollar limit, defaulting to what's left of the month's budget after the
forecast (0017): `room = monthly budget − projected`. The limit is editable and
optional, and there is none by default when the household has no budget.

## Cost of a proposed meal

A library recipe costs one meal at its base servings, which is the same figure
the planner shows (`useRecipeCosts` runs on `usePlannerCosts`, so there is one
costing path, and a manual meal price wins). An unpriced recipe or a fresh AI
idea (its ingredients aren't priced until it's saved) stands in at the
**median priced recipe for that slot**. If it counted as free it would win
every budget decision, and the review marks it with "~". With no priced
recipes there is no basis for a budget, and the option explains how to get one.

## Budgeting happens while the plan is built, not after

The first version built the normal plan, then swapped the priciest meals for
cheaper ones until it fit. That fails on small libraries. Three recipes
rotating A-B-C put every pricey A between the two cheap ones, so every
single-cell swap creates a back-to-back repeat. Swaps can't reorder the
neighbours.

`buildMonthPlan` takes the budget instead. Each cell gets an **allowance**:
what's left of the budget divided by the cells left. It takes the next recipe
in its usual rotation that fits the allowance. If none fits, it takes the
cheapest recipe that isn't a back-to-back repeat. Under budget pressure the
variety rule relaxes from "nothing from the last couple of meals" to "not the
same as yesterday", before the budget gives way. Properties:

- With a generous budget the plan is **identical** to the unbudgeted one.
- Cheap meals build up slack that lets a pricier favourite back in later, so
  favourites appear wherever the money allows instead of being banned.
- An out-of-reach limit goes as cheap as variety allows and says so ("even the
  cheapest picks run over"). It never blocks the user.
- AI ideas keep their placement and count at the stand-in cost.

The review shows the running total against the limit and updates as rows are
swapped or skipped. It also says how many meals the budget changed (by diffing
against the unbudgeted plan) and shows each recipe's cost in the swap menu.

## Related changes

- `buildMonthPlan` skips already-planned cells itself (`isOccupied`), instead
  of the panel dropping them afterwards. Budget isn't spent on meals that are
  thrown away, and AI ideas no longer land on taken cells.
- Auto-fill fills only from today to month end. Past days aren't worth
  planning, and the room is forecast from today.
