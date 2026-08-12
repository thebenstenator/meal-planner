-- Shopping categories — store sections (produce, baking, …) that group a
-- shopping list the way you walk the aisles.
--
-- Items already carry a free-text `category` slug (from the canonical
-- ingredient, or guessed). This adds the household-owned *registry* of those
-- slugs: display name, order, and which ones exist at all. The slug on the item
-- stays the join key (no FK), so generation and the existing RPC are unchanged
-- and a deleted category simply falls back to "other".
--
-- A second table lets a household override an ingredient's category ("eggs live
-- in dairy for us") — including for global seed rows, which RLS makes read-only.
-- Overrides are applied at generation time, so a recategorized item stays put
-- when the list is regenerated.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.shopping_category (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  -- Stable identity, matched against shopping_list_item.category.
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name text not null check (length(trim(name)) > 0),
  -- Aisle order: lower sorts first.
  position integer not null default 0,
  -- The "other" bucket: always present, can be renamed but not deleted.
  is_fallback boolean not null default false,
  unique (household_id, slug)
);

create index shopping_category_household_idx on public.shopping_category (household_id, position);

create trigger shopping_category_set_updated_at
  before update on public.shopping_category
  for each row execute function public.set_updated_at();

create table public.household_ingredient_category (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  canonical_ingredient_id uuid not null references public.canonical_ingredient (id) on delete cascade,
  category text not null,
  unique (household_id, canonical_ingredient_id)
);

create index household_ingredient_category_household_idx
  on public.household_ingredient_category (household_id);

create trigger household_ingredient_category_set_updated_at
  before update on public.household_ingredient_category
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.shopping_category enable row level security;
alter table public.household_ingredient_category enable row level security;

create policy "shopping_category: members read"
  on public.shopping_category for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "shopping_category: members insert"
  on public.shopping_category for insert
  to authenticated
  with check (public.is_household_member(household_id));

create policy "shopping_category: members update"
  on public.shopping_category for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- The fallback bucket is not deletable — every item needs somewhere to land.
create policy "shopping_category: members delete non-fallback"
  on public.shopping_category for delete
  to authenticated
  using (public.is_household_member(household_id) and is_fallback = false);

create policy "household_ingredient_category: members manage"
  on public.household_ingredient_category for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Defaults — a typical grocery walk, in aisle order. Mirrored in
-- src/features/shopping-list/categories.ts (DEFAULT_CATEGORIES); keep both in
-- sync. The slugs match the categories used by the canonical ingredient seed.
-- ---------------------------------------------------------------------------
create or replace function public.seed_shopping_categories(p_household_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.shopping_category (household_id, slug, name, position, is_fallback)
  values
    (p_household_id, 'produce',    'Produce',            10,  false),
    (p_household_id, 'bakery',     'Bakery',             20,  false),
    (p_household_id, 'deli',       'Deli',               30,  false),
    (p_household_id, 'meat',       'Meat',               40,  false),
    (p_household_id, 'seafood',    'Seafood',            50,  false),
    (p_household_id, 'dairy',      'Dairy & eggs',       60,  false),
    (p_household_id, 'frozen',     'Frozen',             70,  false),
    (p_household_id, 'canned',     'Canned goods',       80,  false),
    (p_household_id, 'pantry',     'Pantry',             90,  false),
    (p_household_id, 'baking',     'Baking',             100, false),
    (p_household_id, 'spices',     'Spices',             110, false),
    (p_household_id, 'condiments', 'Condiments & sauces', 120, false),
    (p_household_id, 'breakfast',  'Breakfast',          130, false),
    (p_household_id, 'snacks',     'Snacks',             140, false),
    (p_household_id, 'beverages',  'Beverages',          150, false),
    (p_household_id, 'household',  'Household',          160, false),
    (p_household_id, 'other',      'Other',              900, true)
  on conflict (household_id, slug) do nothing;
$$;

create or replace function public.seed_shopping_categories_for_new_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_shopping_categories(new.id);
  return new;
end;
$$;

create trigger household_seed_shopping_categories
  after insert on public.household
  for each row execute function public.seed_shopping_categories_for_new_household();

-- Definer functions, so they're callable only from the trigger — never as an
-- RPC against someone else's household.
revoke all on function public.seed_shopping_categories(uuid) from public, anon, authenticated;
revoke all on function public.seed_shopping_categories_for_new_household() from public, anon, authenticated;

-- Backfill existing households.
do $$
declare
  h record;
begin
  for h in select id from public.household loop
    perform public.seed_shopping_categories(h.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deleting a category is decisive: anything filed under it moves to the target
-- (the fallback bucket by default) rather than lingering under a slug that no
-- longer exists.
-- ---------------------------------------------------------------------------
create or replace function public.delete_shopping_category(
  p_id uuid,
  p_reassign_to text default 'other'
)
returns void
language plpgsql
as $$
declare
  v_household_id uuid;
  v_slug text;
  v_fallback boolean;
begin
  select household_id, slug, is_fallback
    into v_household_id, v_slug, v_fallback
  from public.shopping_category
  where id = p_id;

  if v_household_id is null then
    raise exception 'category not found' using errcode = 'P0002';
  end if;
  if not public.is_household_member(v_household_id) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;
  if v_fallback then
    raise exception 'the fallback category cannot be deleted' using errcode = '23514';
  end if;
  if p_reassign_to = v_slug then
    raise exception 'cannot reassign a category to itself' using errcode = '22023';
  end if;

  update public.shopping_list_item i
  set category = p_reassign_to
  where i.category = v_slug
    and exists (
      select 1 from public.shopping_list l
      where l.id = i.shopping_list_id and l.household_id = v_household_id
    );

  update public.household_ingredient_category
  set category = p_reassign_to
  where household_id = v_household_id and category = v_slug;

  -- Household-owned canonical rows only; global seed rows are reference data.
  update public.canonical_ingredient
  set category = p_reassign_to
  where household_id = v_household_id and category = v_slug;

  delete from public.shopping_category where id = p_id;
end;
$$;
