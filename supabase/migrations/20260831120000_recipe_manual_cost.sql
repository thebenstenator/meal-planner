-- A manual price for a meal.
--
-- Until now a recipe's cost could only be *derived* from its ingredient prices
-- (consumptionCost, summed). That leaves meals with no priced ingredients — or
-- ones you'd rather just quote a flat figure for — showing as "not priced". This
-- lets the user set the cost directly. When present it wins over the computed
-- cost everywhere cost is shown (recipe card, planner meal card, budget bar);
-- clearing it (back to null) falls back to the ingredient calculation.

alter table public.recipe
  add column manual_cost_cents integer check (manual_cost_cents is null or manual_cost_cents >= 0);

comment on column public.recipe.manual_cost_cents is
  'A manually set total cost for the recipe at its base servings, in whole cents. '
  'When non-null it overrides the ingredient-derived cost. NULL means "compute it '
  'from ingredient prices".';
