-- Actual price paid, captured (optionally) at check-off. When set, it overrides
-- the estimated cost for spend tracking; null falls back to the estimate.
alter table public.shopping_list_item
  add column actual_cost_cents integer
  check (actual_cost_cents is null or actual_cost_cents >= 0);
