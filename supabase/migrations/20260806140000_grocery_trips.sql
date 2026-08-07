-- Slice 12 — Grocery trips (receipt scanning)
-- A scanned receipt becomes a grocery_trip (one shopping run: store + date +
-- total) with its line items. Trips are the source of truth for *actual* spend
-- (before this we proxied spend from checked-off shopping-list items). Line
-- items with a matched canonical + a store also feed price_record so budget
-- estimates get more accurate over time. All money is integer cents.

create table public.grocery_trip (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  store_id uuid references public.store (id) on delete set null,
  purchased_on date not null default current_date,
  total_cents integer not null check (total_cents >= 0),
  note text
);

create index grocery_trip_month_idx on public.grocery_trip (household_id, purchased_on desc);

create trigger grocery_trip_set_updated_at
  before update on public.grocery_trip
  for each row execute function public.set_updated_at();

create table public.trip_line_item (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trip_id uuid not null references public.grocery_trip (id) on delete cascade,
  household_id uuid not null references public.household (id) on delete cascade,
  raw_text text not null,
  canonical_ingredient_id uuid references public.canonical_ingredient (id) on delete set null,
  quantity numeric,
  unit text,
  price_cents integer check (price_cents is null or price_cents >= 0),
  position integer not null default 0
);

create index trip_line_item_trip_idx on public.trip_line_item (trip_id, position);

-- ---------------------------------------------------------------------------
-- Row Level Security — household members manage their own trips + lines.
-- ---------------------------------------------------------------------------
alter table public.grocery_trip enable row level security;
alter table public.trip_line_item enable row level security;

create policy "grocery_trip: members manage"
  on public.grocery_trip for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "trip_line_item: members manage"
  on public.trip_line_item for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
