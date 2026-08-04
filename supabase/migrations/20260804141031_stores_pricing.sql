-- Slice 7 — Stores & Pricing
-- Prices are user-owned truth: package price + package size, entered per store.
-- price_record is APPEND-ONLY (never update a price — insert a new record); the
-- current price is the most recent observation. All money is integer cents.

create table public.store (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  name text not null
);

create index store_household_idx on public.store (household_id);

create trigger store_set_updated_at
  before update on public.store
  for each row execute function public.set_updated_at();

create table public.price_record (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  canonical_ingredient_id uuid not null references public.canonical_ingredient (id) on delete cascade,
  store_id uuid not null references public.store (id) on delete cascade,
  price_cents integer not null check (price_cents >= 0),
  package_quantity numeric not null check (package_quantity > 0),
  package_unit text not null,
  source text not null default 'manual' check (source in ('manual', 'receipt_ocr', 'estimated')),
  observed_on date not null default current_date
);

create index price_record_lookup_idx
  on public.price_record (household_id, store_id, canonical_ingredient_id, observed_on desc);

-- default_store_id was added as a bare column in Slice 1; wire the FK now.
alter table public.household
  add constraint household_default_store_fk
  foreign key (default_store_id) references public.store (id) on delete set null;

-- Configurable staleness threshold (days) for the "review stale prices" flow.
alter table public.household
  add column price_stale_days integer not null default 30 check (price_stale_days > 0);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.store enable row level security;
alter table public.price_record enable row level security;

create policy "store: members manage"
  on public.store for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- price_record is append-only for clients: insert + read, no update/delete.
create policy "price_record: members read"
  on public.price_record for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "price_record: members insert"
  on public.price_record for insert
  to authenticated
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Current price = the most recent record per (canonical, store). Runs as
-- invoker so RLS on price_record scopes it to the household.
-- ---------------------------------------------------------------------------
create or replace function public.get_current_prices(p_store_id uuid)
returns table (
  canonical_ingredient_id uuid,
  price_cents integer,
  package_quantity numeric,
  package_unit text,
  observed_on date
)
language sql
stable
as $$
  select distinct on (pr.canonical_ingredient_id)
    pr.canonical_ingredient_id,
    pr.price_cents,
    pr.package_quantity,
    pr.package_unit,
    pr.observed_on
  from public.price_record pr
  where pr.store_id = p_store_id
  order by pr.canonical_ingredient_id, pr.observed_on desc, pr.created_at desc;
$$;
