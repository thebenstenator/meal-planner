-- A household's standing "running" shopping list: a persistent list (no date
-- range) you jot into anytime ("we're out of dish soap"), separate from the
-- weekly lists generated off the meal plan. At most one per household.
alter table public.shopping_list
  add column is_running boolean not null default false;

create unique index shopping_list_one_running_per_household
  on public.shopping_list (household_id)
  where is_running;

comment on column public.shopping_list.is_running is
  'True for the household''s single standing list you add ad-hoc items to (no date range).';
