-- Slice 11 — Pantry (smart inventory). One row per canonical ingredient per
-- location; quantity is kept in a single unit per row. Later slices increment
-- this on check-off (bought) and decrement it on cook, so it stays current with
-- minimal manual upkeep.
create table public.pantry_item (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  canonical_ingredient_id uuid not null references public.canonical_ingredient (id) on delete cascade,
  quantity numeric not null default 0 check (quantity >= 0),
  unit text,
  location text not null default 'pantry' check (location in ('pantry', 'fridge', 'freezer')),
  expires_on date,
  unique (household_id, canonical_ingredient_id, location)
);

create index pantry_item_household_idx on public.pantry_item (household_id);
create index pantry_item_canonical_idx on public.pantry_item (canonical_ingredient_id);

create trigger pantry_item_set_updated_at
  before update on public.pantry_item
  for each row execute function public.set_updated_at();

alter table public.pantry_item enable row level security;

create policy "pantry_item: members manage"
  on public.pantry_item for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
