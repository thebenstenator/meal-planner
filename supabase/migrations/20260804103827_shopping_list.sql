-- Slice 6 — Shopping List Generation (the payoff slice)
-- The consolidated output of the engine, persisted. shopping_list_item is the
-- money table (specs/03). Prices arrive in Slice 7; pantry offset in V2.

create table public.shopping_list (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  name text not null,
  date_range_start date,
  date_range_end date,
  store_id uuid,
  status text not null default 'active' check (status in ('draft', 'active', 'completed')),
  generated_at timestamptz not null default now()
);

create index shopping_list_household_idx on public.shopping_list (household_id);

create trigger shopping_list_set_updated_at
  before update on public.shopping_list
  for each row execute function public.set_updated_at();

create table public.shopping_list_item (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  shopping_list_id uuid not null references public.shopping_list (id) on delete cascade,
  canonical_ingredient_id uuid references public.canonical_ingredient (id) on delete set null,
  ad_hoc_name text,
  display_name text not null,
  total_quantity numeric,
  unit text,
  category text,
  unresolved boolean not null default false,
  sub_totals jsonb,
  purchase jsonb,
  no_quantity_count integer not null default 0,
  estimated_price_cents integer,
  price_is_stale boolean not null default false,
  is_checked boolean not null default false,
  position integer not null default 0
);

create index shopping_list_item_list_idx on public.shopping_list_item (shopping_list_id);

create trigger shopping_list_item_set_updated_at
  before update on public.shopping_list_item
  for each row execute function public.set_updated_at();

-- Provenance: which recipe lines (via which plan entries) fed this item.
create table public.shopping_list_item_source (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  shopping_list_item_id uuid not null references public.shopping_list_item (id) on delete cascade,
  recipe_ingredient_id uuid references public.recipe_ingredient (id) on delete set null,
  plan_entry_id uuid references public.plan_entry (id) on delete set null,
  contributed_quantity numeric
);

create index shopping_list_item_source_item_idx
  on public.shopping_list_item_source (shopping_list_item_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.shopping_list enable row level security;
alter table public.shopping_list_item enable row level security;
alter table public.shopping_list_item_source enable row level security;

create policy "shopping_list: members manage"
  on public.shopping_list for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "shopping_list_item: members manage"
  on public.shopping_list_item for all
  to authenticated
  using (
    exists (
      select 1 from public.shopping_list l
      where l.id = shopping_list_id and public.is_household_member(l.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.shopping_list l
      where l.id = shopping_list_id and public.is_household_member(l.household_id)
    )
  );

create policy "shopping_list_item_source: members manage"
  on public.shopping_list_item_source for all
  to authenticated
  using (
    exists (
      select 1
      from public.shopping_list_item i
      join public.shopping_list l on l.id = i.shopping_list_id
      where i.id = shopping_list_item_id and public.is_household_member(l.household_id)
    )
  )
  with check (
    exists (
      select 1
      from public.shopping_list_item i
      join public.shopping_list l on l.id = i.shopping_list_id
      where i.id = shopping_list_item_id and public.is_household_member(l.household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Persist a generated list atomically. The engine runs client-side (it's pure
-- TS), so this takes already-consolidated items as jsonb and replaces the list's
-- items in one transaction. On regenerate (p_list_id given) it preserves
-- is_checked by matching items on canonical id / ad-hoc name / display name.
-- ---------------------------------------------------------------------------
create or replace function public.generate_shopping_list(
  p_household_id uuid,
  p_name text,
  p_start date,
  p_end date,
  p_items jsonb,
  p_list_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_list_id uuid := p_list_id;
  v_checked jsonb := '{}'::jsonb;
  v_item_id uuid;
  v_pos int := 0;
  elem jsonb;
  v_key text;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;

  if v_list_id is null then
    insert into public.shopping_list (household_id, name, date_range_start, date_range_end)
    values (p_household_id, p_name, p_start, p_end)
    returning id into v_list_id;
  else
    -- Snapshot existing check-off state, then refresh the list metadata.
    select coalesce(jsonb_object_agg(k, checked), '{}'::jsonb) into v_checked
    from (
      select coalesce(canonical_ingredient_id::text, lower(ad_hoc_name), display_name) as k,
             bool_or(is_checked) as checked
      from public.shopping_list_item
      where shopping_list_id = v_list_id
      group by 1
    ) s;

    update public.shopping_list
    set name = p_name, date_range_start = p_start, date_range_end = p_end,
        generated_at = now()
    where id = v_list_id;

    delete from public.shopping_list_item where shopping_list_id = v_list_id;
  end if;

  for elem in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_key := coalesce(
      elem->>'canonical_ingredient_id',
      lower(elem->>'ad_hoc_name'),
      elem->>'display_name'
    );

    insert into public.shopping_list_item (
      shopping_list_id, canonical_ingredient_id, ad_hoc_name, display_name,
      total_quantity, unit, category, unresolved, sub_totals, purchase,
      no_quantity_count, is_checked, position
    )
    values (
      v_list_id,
      (elem->>'canonical_ingredient_id')::uuid,
      elem->>'ad_hoc_name',
      elem->>'display_name',
      (elem->>'total_quantity')::numeric,
      elem->>'unit',
      elem->>'category',
      coalesce((elem->>'unresolved')::boolean, false),
      elem->'sub_totals',
      elem->'purchase',
      coalesce((elem->>'no_quantity_count')::int, 0),
      coalesce((v_checked->>v_key)::boolean, false),
      v_pos
    )
    returning id into v_item_id;

    insert into public.shopping_list_item_source (
      shopping_list_item_id, recipe_ingredient_id, plan_entry_id, contributed_quantity
    )
    select
      v_item_id,
      (s->>'recipe_ingredient_id')::uuid,
      (s->>'plan_entry_id')::uuid,
      (s->>'contributed_quantity')::numeric
    from jsonb_array_elements(coalesce(elem->'sources', '[]'::jsonb)) s;

    v_pos := v_pos + 1;
  end loop;

  return v_list_id;
end;
$$;
