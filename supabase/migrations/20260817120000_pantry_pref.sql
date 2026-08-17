-- Per-household, per-ingredient "track this in the pantry?" preference.
--
-- Check-off decides whether a bought item goes into the pantry from the
-- food/non-food heuristics (Household aisle + a keyword denylist). Those are
-- best-effort and can't be perfect, so this table lets a household pin the
-- answer for a specific ingredient — "always track / never track this" — which
-- wins over the heuristic. Set from the "Added to pantry / Not added" toggle on
-- the shopping list.
--
-- Mirrors household_ingredient_category exactly (same key, same RLS): the
-- absence of a row means "use the automatic default", so nothing is backfilled.

create table public.household_ingredient_pantry_pref (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  canonical_ingredient_id uuid not null references public.canonical_ingredient (id) on delete cascade,
  -- true = always add to the pantry when bought; false = never.
  tracked boolean not null,
  unique (household_id, canonical_ingredient_id)
);

create index household_ingredient_pantry_pref_household_idx
  on public.household_ingredient_pantry_pref (household_id);

create trigger household_ingredient_pantry_pref_set_updated_at
  before update on public.household_ingredient_pantry_pref
  for each row execute function public.set_updated_at();

alter table public.household_ingredient_pantry_pref enable row level security;

create policy "household_ingredient_pantry_pref: members manage"
  on public.household_ingredient_pantry_pref for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
