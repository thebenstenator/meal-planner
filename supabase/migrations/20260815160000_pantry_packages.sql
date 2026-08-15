-- Package-aware pantry. A pantry_item keeps its single quantity/unit total (the
-- source of truth cook-deduction, low-stock and the "use it up" insight all read),
-- and this child table describes the sealed containers that make it up — so you
-- can record "2 x 32oz cans + 2 x 16oz cans" instead of a flat "96 oz". The
-- remainder (quantity - sum of sealed) is the loose/opened amount, kept implicit.
create table public.pantry_package (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pantry_item_id uuid not null references public.pantry_item (id) on delete cascade,
  size numeric not null check (size > 0),
  unit text not null,
  count integer not null default 1 check (count > 0)
);

create index pantry_package_item_idx on public.pantry_package (pantry_item_id);

create trigger pantry_package_set_updated_at
  before update on public.pantry_package
  for each row execute function public.set_updated_at();

alter table public.pantry_package enable row level security;

-- Inherit access from the parent pantry_item's household (mirrors the
-- recipe_ingredient policy).
create policy "pantry_package: members manage"
  on public.pantry_package for all
  to authenticated
  using (
    exists (
      select 1 from public.pantry_item pi
      where pi.id = pantry_item_id and public.is_household_member(pi.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.pantry_item pi
      where pi.id = pantry_item_id and public.is_household_member(pi.household_id)
    )
  );
