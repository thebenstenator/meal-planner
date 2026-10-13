-- AI price estimates (ADR 0022). For ingredients with no reference price —
-- mostly ones a household created itself — a premium household can ask Claude
-- for a typical US price. The estimate is stored here, per household, and used
-- exactly like a reference price: below the household's own store price, shown
-- as EST, scaled by calibration. Re-estimating replaces it.

create table public.household_price_estimate (
  household_id uuid not null references public.household (id) on delete cascade,
  canonical_ingredient_id uuid not null
    references public.canonical_ingredient (id) on delete cascade,
  price_cents integer not null check (price_cents >= 0),
  package_quantity numeric not null check (package_quantity > 0),
  package_unit text not null,
  source text not null default 'ai' check (source in ('ai')),
  estimated_at timestamptz not null default now(),
  primary key (household_id, canonical_ingredient_id)
);

alter table public.household_price_estimate enable row level security;

create policy "household_price_estimate: members manage"
  on public.household_price_estimate for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
