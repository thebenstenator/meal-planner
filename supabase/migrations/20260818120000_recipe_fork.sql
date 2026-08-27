-- Copy-on-edit for shared recipes.
--
-- Until now a non-owner could only *read* a recipe shared through a pool: the
-- creator household is the sole writer (20260815190000_recipe_pool_options.sql).
-- This lets a non-owner edit anyway — by saving their changes as a *new* recipe
-- owned by their own household, leaving the shared original untouched. No RLS
-- change is needed: the copy is an ordinary insert into the editor's household,
-- which the existing "recipe: creator writes" policy already allows. The only
-- new state is a link back to what the copy was made from.

alter table public.recipe
  add column forked_from_recipe_id uuid references public.recipe (id) on delete set null;

comment on column public.recipe.forked_from_recipe_id is
  'Set when a non-owner edited a shared recipe: the original it was copied from. '
  'ON DELETE SET NULL — the copy is fully independent, so losing the original '
  'only drops the attribution, never the recipe.';

-- ---------------------------------------------------------------------------
-- save_recipe: carry forked_from_recipe_id on insert, so a copy remembers its
-- origin. The update branch never touches it — provenance is stamped once, at
-- copy time, and a later edit of the copy must not rewrite or clear it.
-- Otherwise identical to the version in 20260815190000.
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
    canonical_ingredient_id, descriptor, is_optional, parse_confidence, needs_review
  )
  select
    v_id,
    (row_number() over ())::int - 1,
    elem->>'raw_text',
    (elem->>'quantity')::numeric,
    elem->>'unit',
    (elem->>'canonical_ingredient_id')::uuid,
    elem->>'descriptor',
    coalesce((elem->>'is_optional')::boolean, false),
    (elem->>'parse_confidence')::numeric,
    coalesce((elem->>'needs_review')::boolean, false)
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) elem
  where coalesce(elem->>'raw_text', '') <> '';

  return v_id;
end;
$$;
