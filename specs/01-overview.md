# 01 — Overview

## The problem

Families who cook from their own recipes have to run three disconnected systems:

1. A meal plan (paper, whiteboard, Skylight calendar, or a notes app)
2. A shopping list (manually transcribed from the meal plan, error-prone)
3. A grocery budget (a guess, or a post-hoc look at the bank statement)

Existing apps each solve one or two of these, none solve all three, and the ones
that do pricing get it wrong in a specific way that makes it useless.

## The two gaps nobody has filled

### Gap 1 — Ingredient consolidation

Existing shopping lists treat each recipe's ingredients as separate line items.
If three recipes this month need cream cheese — 8 oz, 4 oz, and 1 cup — the list
shows three entries. The user has to do the mental math at the store, and the
cost estimate is meaningless.

**We merge them into one line item, in one unit, with one price.**

This is the hardest engineering problem in the product and the entire reason
the product exists. See `05-ingredient-engine.md`.

### Gap 2 — Real per-item pricing

Competitors that show cost show **cost per serving** — a derived, abstract number.
Users want to know: *what will this month's grocery bill actually be, at my store,
at the prices I actually pay?*

**We track price per item, per store, entered/updated by the user, and roll it
up into a real projected total.**

## Secondary differentiators

- **Multi-page recipe capture.** Skylight lets you photograph a recipe, but not a
  recipe that spans two cookbook pages. We accept N photos → one recipe.
- **Everything under one roof.** Planner + recipes + list + prices + pantry +
  budget in one app instead of four.
- **Not just dinner.** Mains, sides, desserts, snacks, and explicit "leftovers"
  and "eating out" days, because that's how people actually plan a month.

## Target user

Primary: the household grocery planner — usually one person who plans meals,
builds the list, and shops. Cooks from family recipes, not just internet recipes.
Cares about the grocery budget. Comfortable with apps but not technical.

Secondary: their partner, who needs read/write access to the same plan and list
(sharing is a V1 requirement, not a nice-to-have).

## Product principles

1. **Manual data entry must feel cheap.** Every place a user types, ask whether
   a photo, a default, or a remembered value could do it instead.
2. **Prices are user-owned truth.** We do not pretend to know what things cost at
   their store. We make it trivially easy for them to tell us and to keep it fresh.
3. **Never block on the hard case.** When consolidation or parsing can't resolve
   something automatically, surface it for a two-tap human fix. Never silently
   guess, never hard-fail.
4. **The month is the unit.** Most competitors think in weeks. This product thinks
   in months, because budgets are monthly.

## Success criteria for V1

A user can:
- Add a recipe by photographing a physical page (including multi-page)
- Fill a month of the planner with mains, sides, desserts, snacks, leftovers
- Generate one consolidated shopping list for any date range in that month
- Enter prices once and see a credible projected total for the month
- Share all of the above with their partner in real time
- Do all of it in a grocery store with one bar of signal
