-- Eating-out costs (ADR 0019). An eating-out plan entry can carry what the meal
-- costs; it counts against the same monthly budget as groceries — as spend once
-- its day arrives, as forecast before then. Only eating-out entries may have one.

alter table public.plan_entry
  add column cost_cents integer
  check (cost_cents is null or (cost_cents >= 0 and kind = 'eating_out'));

comment on column public.plan_entry.cost_cents is
  'What an eating-out meal costs (cents). Spend on/after its date; forecast before.';
