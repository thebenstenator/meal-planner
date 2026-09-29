-- Ingredient sections ("Lemon curd", "Lemon cookies").
--
-- A recipe's ingredients can be grouped under headings. Rather than a separate
-- section table, each ingredient row carries its section's name: the rows are
-- already ordered by `position`, so a run of rows with the same name is a
-- section. Null means "no heading" (every existing recipe, and simple ones).
-- No RLS change — it's a column on a table whose policies already apply.

alter table public.recipe_ingredient
  add column section text;

comment on column public.recipe_ingredient.section is
  'Heading this ingredient sits under (e.g. "Lemon curd"), or null. Consecutive '
  'rows (by position) with the same value form one section.';

-- ---------------------------------------------------------------------------
-- save_recipe: also write `section`. Positions now come from the array's own
-- order (WITH ORDINALITY) rather than an unordered row_number(), since the order
-- is what groups rows into sections. Otherwise identical to the version in
-- 20260818120000_recipe_fork.sql.
-- ---------------------------------------------------------------------------
create or replace function public.save_recipe(
  p_recipe jsonb,
  p_ingredients jsonb,
  p_recipe_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := p_recipe_id;
begin
  if v_id is null then
    insert into public.recipe (
      household_id, forked_from_recipe_id, title, description, meal_types, servings,
      prep_minutes, cook_minutes, instructions, source, tags, notes, rating
    )
    values (
      (p_recipe->>'household_id')::uuid,
      (p_recipe->>'forked_from_recipe_id')::uuid,
      p_recipe->>'title',
      p_recipe->>'description',
      coalesce((select array_agg(v) from jsonb_array_elements_text(p_recipe->'meal_types') v), '{}'),
      coalesce((p_recipe->>'servings')::int, 4),
      (p_recipe->>'prep_minutes')::int,
      (p_recipe->>'cook_minutes')::int,
      p_recipe->>'instructions',
      p_recipe->>'source',
      coalesce((select array_agg(v) from jsonb_array_elements_text(p_recipe->'tags') v), '{}'),
      p_recipe->>'notes',
      (p_recipe->>'rating')::smallint
    )
    returning id into v_id;
  else
    update public.recipe set
      title = p_recipe->>'title',
      description = p_recipe->>'description',
      meal_types = coalesce((select array_agg(v) from jsonb_array_elements_text(p_recipe->'meal_types') v), '{}'),
      servings = coalesce((p_recipe->>'servings')::int, servings),
      prep_minutes = (p_recipe->>'prep_minutes')::int,
      cook_minutes = (p_recipe->>'cook_minutes')::int,
      instructions = p_recipe->>'instructions',
      source = p_recipe->>'source',
      tags = coalesce((select array_agg(v) from jsonb_array_elements_text(p_recipe->'tags') v), '{}'),
      notes = p_recipe->>'notes',
      rating = (p_recipe->>'rating')::smallint
    where id = v_id;

    if not found then
      raise exception 'recipe not found or not permitted' using errcode = '42501';
    end if;
  end if;

  delete from public.recipe_ingredient where recipe_id = v_id;

  insert into public.recipe_ingredient (
    recipe_id, position, raw_text, quantity, unit,
    canonical_ingredient_id, descriptor, is_optional, parse_confidence, needs_review,
    section
  )
  select
    v_id,
    (row_number() over (order by e.ord))::int - 1,
    e.elem->>'raw_text',
    (e.elem->>'quantity')::numeric,
    e.elem->>'unit',
    (e.elem->>'canonical_ingredient_id')::uuid,
    e.elem->>'descriptor',
    coalesce((e.elem->>'is_optional')::boolean, false),
    (e.elem->>'parse_confidence')::numeric,
    coalesce((e.elem->>'needs_review')::boolean, false),
    nullif(btrim(e.elem->>'section'), '')
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) with ordinality as e(elem, ord)
  where coalesce(e.elem->>'raw_text', '') <> '';

  return v_id;
end;
$$;
