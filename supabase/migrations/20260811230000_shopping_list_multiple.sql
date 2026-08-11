-- Multiple named lists per household (e.g. one per store). Until now a household
-- had at most one standing "running" list; now `is_running` marks any standing
-- list you jot into and switch between as tabs, and there can be several. Drop
-- the single-running-per-household cap. Generation targets a chosen list and only
-- replaces its plan-derived items (is_manual = false), leaving jotted items alone.
drop index if exists public.shopping_list_one_running_per_household;

comment on column public.shopping_list.is_running is
  'True for a standing list you jot into and switch between (a store tab); a household can have several.';
