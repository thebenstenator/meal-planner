# 0020 — Cheaper swaps

Status: accepted · Date: 2026-10-13 · Builds on: 0018

The planner suggests cheaper recipes for upcoming meals, e.g. "Tue · Salmon
Bake → Chicken Piccata · save $9", with one-tap **Swap** and **✕** to keep the
meal. It's premium: like auto-fill, it does the thinking for you, and it has no
AI cost. Free users see one line with what it would save ("Cheaper swaps could
save about $23 this week"), so the value is visible before it's paid for.

## What counts as a good swap

`suggestSwaps` takes each recipe meal from today on that hasn't been cooked,
and picks the **best-liked** recipe (auto-fill's `libraryScore`: favourites,
most cooked, not made in a while) that meets all of these:

- **fits the slot**, using auto-fill's rule (`eligibleFor`), so dinner is never
  swapped for a dessert;
- **is cheaper per serving by a margin worth acting on**: at least $2 for the
  meal at its planned servings *and* at least 20% (`MIN_SAVINGS_*`). Small
  savings are noise and would erode trust in the list;
- **is fully priced, and so is the current meal.** A recipe that looks cheap
  only because some ingredients are unpriced is missing data, not saving
  money;
- **doesn't create a back-to-back repeat** with the day before or after in
  that slot.

Savings are per-serving differences times the meal's servings (its override,
else the recipe's own). Largest savings first, one suggestion per meal, at most
five. Costs come from `useRecipeCosts`, the same costing path as the planner,
library and auto-fill.

## Known limitation

A swap changes the plan, not an already-generated shopping list. Like any plan
edit, the list catches up when it's regenerated.
