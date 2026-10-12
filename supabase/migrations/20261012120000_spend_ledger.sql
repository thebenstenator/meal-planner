-- Spend ledger (ADR 0016). grocery_trip is the durable record of actual spend;
-- a checked-off list item only counts as spend until a trip covers it.
--
-- * shopping_list_item.trip_id — the logged trip that already accounts for this
--   item, so it isn't counted twice (trip total + item estimate).
-- * shopping_list_item.checked_at — when it was bought; attributes open checked
--   items to a month, including on running/store lists that have no date range.
-- * grocery_trip.is_estimated — a trip archived from checked items on clear,
--   priced from estimates rather than a typed or scanned total.
-- * clear_checked_items — archives open checked items into estimated trips
--   before deleting them, so clearing a list never erases spend.
-- * generate_shopping_list — regeneration keeps a checked item's paid price,
--   check time and trip link, and never deletes something already bought.

alter table public.shopping_list_item
  add column checked_at timestamptz,
  add column trip_id uuid references public.grocery_trip (id) on delete set null;

-- Best available proxy for when an already-checked item was bought.
update public.shopping_list_item set checked_at = updated_at where is_checked;

create index shopping_list_item_open_checked_idx
  on public.shopping_list_item (checked_at)
  where is_checked and trip_id is null;

create index shopping_list_item_trip_idx on public.shopping_list_item (trip_id);

create or replace function public.shopping_list_item_stamp_checked()
returns trigger
language plpgsql
as $$
begin
  if not new.is_checked then
    new.checked_at := null;
  elsif tg_op = 'INSERT' or not old.is_checked then
    new.checked_at := coalesce(new.checked_at, now());
  end if;
  return new;
end;
$$;

create trigger shopping_list_item_stamp_checked
  before insert or update of is_checked on public.shopping_list_item
  for each row execute function public.shopping_list_item_stamp_checked();

alter table public.grocery_trip
  add column is_estimated boolean not null default false;

-- ---------------------------------------------------------------------------
-- clear_checked_items: archive, then delete.
-- p_estimates maps item id → estimated cents (unit conversion lives in the
-- client engine, so the caller prices what it can). A recorded actual price
-- wins. One estimated trip per local purchase day; items already covered by a
-- logged trip are just deleted.
-- ---------------------------------------------------------------------------
create or replace function public.clear_checked_items(
  p_list_id uuid,
  p_estimates jsonb default '{}'::jsonb,
  p_tz text default 'UTC'
)
returns void
language plpgsql
as $$
declare
  v_household uuid;
  v_list_name text;
  v_store uuid;
  v_trip uuid;
  r record;
begin
  select household_id, name into v_household, v_list_name
  from public.shopping_list where id = p_list_id;
  if v_household is null or not public.is_household_member(v_household) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;

  select default_store_id into v_store from public.household where id = v_household;

  for r in
    select (coalesce(i.checked_at, now()) at time zone p_tz)::date as day,
           sum(coalesce(i.actual_cost_cents, (p_estimates->>i.id::text)::int)) as total
    from public.shopping_list_item i
    where i.shopping_list_id = p_list_id and i.is_checked and i.trip_id is null
    group by 1
  loop
    -- Nothing priced that day: no spend to keep, so no empty trip.
    continue when coalesce(r.total, 0) = 0;

    insert into public.grocery_trip
      (household_id, store_id, purchased_on, total_cents, note, is_estimated)
    values (v_household, v_store, r.day, r.total, v_list_name, true)
    returning id into v_trip;

    insert into public.trip_line_item
      (trip_id, household_id, raw_text, canonical_ingredient_id, quantity, unit, price_cents, position)
    select v_trip, v_household, i.display_name, i.canonical_ingredient_id, i.total_quantity, i.unit,
           coalesce(i.actual_cost_cents, (p_estimates->>i.id::text)::int),
           (row_number() over (order by i.position))::int - 1
    from public.shopping_list_item i
    where i.shopping_list_id = p_list_id and i.is_checked and i.trip_id is null
      and (coalesce(i.checked_at, now()) at time zone p_tz)::date = r.day;
  end loop;

  delete from public.shopping_list_item
  where shopping_list_id = p_list_id and is_checked;
end;
$$;

-- ---------------------------------------------------------------------------
-- generate_shopping_list: carry a checked item's state across regeneration and
-- keep bought items whose need disappeared (they're spend, not a stale need).
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
  v_prev jsonb := '{}'::jsonb;
  v_new_keys text[];
  v_item_id uuid;
  v_pos int := 0;
  elem jsonb;
  v_key text;
  v_state jsonb;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;

  select coalesce(array_agg(coalesce(
           e->>'canonical_ingredient_id', lower(e->>'ad_hoc_name'), e->>'display_name')), '{}')
  into v_new_keys
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e;

  if v_list_id is null then
    insert into public.shopping_list (household_id, name, date_range_start, date_range_end)
    values (p_household_id, p_name, p_start, p_end)
    returning id into v_list_id;
  else
    select coalesce(jsonb_object_agg(k, jsonb_build_object(
             'checked', checked, 'checked_at', checked_at,
             'trip_id', trip_id, 'actual_cost_cents', actual_cost_cents)), '{}'::jsonb)
    into v_prev
    from (
      select coalesce(canonical_ingredient_id::text, lower(ad_hoc_name), display_name) as k,
             bool_or(is_checked) as checked,
             min(checked_at) as checked_at,
             max(trip_id::text) as trip_id,
             sum(actual_cost_cents) as actual_cost_cents
      from public.shopping_list_item
      where shopping_list_id = v_list_id and is_manual = false
      group by 1
    ) s;

    update public.shopping_list
    set name = p_name, date_range_start = p_start, date_range_end = p_end,
        generated_at = now()
    where id = v_list_id;

    -- Keep manually added items. Replace generated ones, except a checked item
    -- the new plan no longer needs — it was bought, so it stays until cleared.
    delete from public.shopping_list_item
    where shopping_list_id = v_list_id and is_manual = false
      and (not is_checked
           or coalesce(canonical_ingredient_id::text, lower(ad_hoc_name), display_name)
              = any (v_new_keys));

    select coalesce(max(position), -1) + 1 into v_pos
    from public.shopping_list_item where shopping_list_id = v_list_id;
  end if;

  for elem in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_key := coalesce(
      elem->>'canonical_ingredient_id',
      lower(elem->>'ad_hoc_name'),
      elem->>'display_name'
    );
    v_state := v_prev->v_key;

    insert into public.shopping_list_item (
      shopping_list_id, canonical_ingredient_id, ad_hoc_name, display_name,
      total_quantity, unit, category, unresolved, sub_totals, purchase,
      no_quantity_count, pantry_offset_quantity, is_checked, position,
      checked_at, trip_id, actual_cost_cents
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
      (elem->>'pantry_offset_quantity')::numeric,
      coalesce((v_state->>'checked')::boolean, false),
      v_pos,
      (v_state->>'checked_at')::timestamptz,
      (v_state->>'trip_id')::uuid,
      (v_state->>'actual_cost_cents')::int
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
