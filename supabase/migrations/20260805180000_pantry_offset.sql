-- Smart pantry Phase 4 — subtract pantry stock during list generation. Store how
-- much of each item was covered by the pantry so the list can show the offset
-- ("need 12 oz - 4 on hand = buy 8"). Fully-covered items are simply not emitted.
alter table public.shopping_list_item
  add column pantry_offset_quantity numeric;

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

    -- Keep manually added items; only replace the generated ones.
    delete from public.shopping_list_item
    where shopping_list_id = v_list_id and is_manual = false;

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

    insert into public.shopping_list_item (
      shopping_list_id, canonical_ingredient_id, ad_hoc_name, display_name,
      total_quantity, unit, category, unresolved, sub_totals, purchase,
      no_quantity_count, pantry_offset_quantity, is_checked, position
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
