-- Slice 4 — Recipes (manual entry)
-- Recipes are irreplaceable family data: soft-delete only (deleted_at), and
-- recipe_ingredient.raw_text is sacred (never overwritten). See specs/03, /10.

create table public.recipe (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  title text not null,
  description text,
  meal_types text[] not null default '{}',
  servings integer not null default 4 check (servings > 0),
  prep_minutes integer check (prep_minutes is null or prep_minutes >= 0),
  cook_minutes integer check (cook_minutes is null or cook_minutes >= 0),
  instructions text,
  source text,
  image_path text,
  tags text[] not null default '{}',
  notes text,
  rating smallint check (rating is null or (rating between 1 and 5)),
  times_cooked integer not null default 0,
  last_cooked_on date,
  import_status text not null default 'manual'
    check (import_status in ('manual', 'ocr_pending', 'ocr_review', 'confirmed')),
  -- Soft delete with 30-day recovery; never hard-delete a recipe.
  deleted_at timestamptz
);

create index recipe_household_idx on public.recipe (household_id);
create index recipe_deleted_at_idx on public.recipe (deleted_at);
create index recipe_title_trgm_idx on public.recipe using gin (title gin_trgm_ops);

create trigger recipe_set_updated_at
  before update on public.recipe
  for each row execute function public.set_updated_at();

create table public.recipe_ingredient (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recipe_id uuid not null references public.recipe (id) on delete cascade,
  position integer not null default 0,
  -- The original line, verbatim. NEVER overwrite with a reconstructed string.
  raw_text text not null,
  quantity numeric,
  unit text,
  canonical_ingredient_id uuid references public.canonical_ingredient (id) on delete set null,
  descriptor text,
  is_optional boolean not null default false,
  parse_confidence numeric check (parse_confidence is null or (parse_confidence between 0 and 1)),
  needs_review boolean not null default false
);

create index recipe_ingredient_recipe_idx on public.recipe_ingredient (recipe_id);
create index recipe_ingredient_canonical_idx on public.recipe_ingredient (canonical_ingredient_id);

create trigger recipe_ingredient_set_updated_at
  before update on public.recipe_ingredient
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.recipe enable row level security;
alter table public.recipe_ingredient enable row level security;

create policy "recipe: members manage"
  on public.recipe for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- recipe_ingredient inherits access from its recipe's household.
create policy "recipe_ingredient: members manage"
  on public.recipe_ingredient for all
  to authenticated
  using (
    exists (
      select 1 from public.recipe r
      where r.id = recipe_id and public.is_household_member(r.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.recipe r
      where r.id = recipe_id and public.is_household_member(r.household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Atomic save: upsert a recipe and replace its ingredient rows in one
-- transaction, so a partial write can never lose a recipe (specs/10). Runs as
-- invoker, so RLS enforces household membership on both tables.
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
      household_id, title, description, meal_types, servings,
      prep_minutes, cook_minutes, instructions, source, tags, notes, rating
    )
    values (
      (p_recipe->>'household_id')::uuid,
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
