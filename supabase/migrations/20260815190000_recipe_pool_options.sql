-- Recipe pools v2 — many pools per household, per-recipe sharing choice.
--
-- v1 (20260815120000_recipe_pools.sql) assumed one pool per household and gave
-- each recipe a single `recipe.pool_id`. Two things that model can't express:
--
--   1. Belonging to several pools (extended family *and* a friend group).
--   2. Deciding, per recipe, which of those pools it goes into — and changing
--      your mind later. `save_recipe` deliberately never moved `pool_id`, so a
--      recipe's sharing was frozen at creation.
--
-- So: drop the one-pool-per-household unique constraint, and replace the single
-- FK with a `recipe_pool_share` join table (a recipe can sit in any subset of
-- the pools its creator household belongs to).
--
-- Permissions also get simpler and more honest. v1 let the pool *owner* edit and
-- delete everyone's recipes and blocked members from deleting their own — which
-- is incoherent once a recipe lives in several pools with several owners. New
-- rule: **the household that added a recipe owns it** (edit, delete, and choose
-- where it's shared); a pool owner moderates by *unsharing* a recipe from their
-- pool, never by editing or deleting someone else's copy.

-- ---------------------------------------------------------------------------
-- Many pools per household
-- ---------------------------------------------------------------------------
alter table public.recipe_pool_member
  drop constraint recipe_pool_member_household_id_key;

-- ---------------------------------------------------------------------------
-- recipe_pool_share — which pools a recipe is shared into
-- ---------------------------------------------------------------------------
create table public.recipe_pool_share (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recipe_id uuid not null references public.recipe (id) on delete cascade,
  pool_id uuid not null references public.recipe_pool (id) on delete cascade,
  unique (recipe_id, pool_id)
);

-- The unique (recipe_id, pool_id) index already covers recipe_id lookups; this
-- covers the other direction ("everything in this pool", cascade on pool delete).
create index recipe_pool_share_pool_idx on public.recipe_pool_share (pool_id);

-- Carry v1's single pool over before the column goes away.
insert into public.recipe_pool_share (recipe_id, pool_id)
select id, pool_id from public.recipe where pool_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Visibility helpers. All SECURITY DEFINER so RLS policies never re-enter the
-- policies on recipe / recipe_pool_share (no recursion, and no surprise cost).
-- ---------------------------------------------------------------------------

-- Every pool the caller can see through any of their households. STABLE, so
-- Postgres evaluates it once per statement rather than once per recipe row.
create or replace function public.my_pool_ids()
returns uuid[]
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(array_agg(pm.pool_id), '{}'::uuid[])
  from public.recipe_pool_member pm
  join public.household_member hm on hm.household_id = pm.household_id
  where hm.user_id = auth.uid();
$$;

create or replace function public.is_recipe_shared_with_me(p_recipe_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.recipe_pool_share s
    where s.recipe_id = p_recipe_id
      and s.pool_id = any (public.my_pool_ids())
  );
$$;

-- The caller's household added this recipe (household_id is the creator).
create or replace function public.is_recipe_creator(p_recipe_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.recipe r
    join public.household_member hm on hm.household_id = r.household_id
    where r.id = p_recipe_id
      and hm.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Retire everything that reads recipe.pool_id, then drop the column. The
-- recipe_ingredient policies subquery recipe.pool_id too, so they have to go
-- first — a policy expression holds a dependency on the columns it references.
-- ---------------------------------------------------------------------------
drop policy "recipe: read own or pool" on public.recipe;
drop policy "recipe: insert own" on public.recipe;
drop policy "recipe: update own or pool-owner" on public.recipe;
drop policy "recipe: delete own household" on public.recipe;
drop policy "recipe_ingredient: read visible" on public.recipe_ingredient;
drop policy "recipe_ingredient: write editable" on public.recipe_ingredient;

-- v1's owner-only soft-delete carve-out goes with the owner-edit rule.
drop trigger recipe_enforce_pool_delete on public.recipe;
drop function public.enforce_pool_recipe_delete();

alter table public.recipe drop column pool_id;

-- ---------------------------------------------------------------------------
-- Recipe RLS — creator household owns the row; pools only widen *reads*.
-- ---------------------------------------------------------------------------
create policy "recipe: read own or shared"
  on public.recipe for select
  to authenticated
  using (
    public.is_household_member(household_id)
    or public.is_recipe_shared_with_me(id)
  );

create policy "recipe: creator writes"
  on public.recipe for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- recipe_ingredient RLS — read follows recipe visibility, write follows creator.
-- ---------------------------------------------------------------------------
create policy "recipe_ingredient: read visible"
  on public.recipe_ingredient for select
  to authenticated
  using (
    public.is_recipe_creator(recipe_id)
    or public.is_recipe_shared_with_me(recipe_id)
  );

create policy "recipe_ingredient: creator writes"
  on public.recipe_ingredient for all
  to authenticated
  using (public.is_recipe_creator(recipe_id))
  with check (public.is_recipe_creator(recipe_id));

-- ---------------------------------------------------------------------------
-- recipe_pool_share RLS — this *is* the sharing permission model.
-- ---------------------------------------------------------------------------
alter table public.recipe_pool_share enable row level security;

create policy "recipe_pool_share: creator or pool member reads"
  on public.recipe_pool_share for select
  to authenticated
  using (
    public.is_recipe_creator(recipe_id)
    or public.is_pool_member(pool_id)
  );

-- Only the household that added a recipe can share it, and only into a pool
-- they belong to. Nobody can push someone else's recipe anywhere.
create policy "recipe_pool_share: creator shares"
  on public.recipe_pool_share for insert
  to authenticated
  with check (
    public.is_recipe_creator(recipe_id)
    and public.is_pool_member(pool_id)
  );

-- The creator unshares their own recipe; a pool owner evicts anything from
-- their pool. That eviction is the owner's whole moderation power now.
create policy "recipe_pool_share: creator or pool owner unshares"
  on public.recipe_pool_share for delete
  to authenticated
  using (
    public.is_recipe_creator(recipe_id)
    or public.is_pool_owner(pool_id)
  );

-- ---------------------------------------------------------------------------
-- Set which pools a recipe is shared into. SECURITY INVOKER on purpose: the
-- policies above decide what actually lands, so a pool owner calling this can
-- only ever drop their own pool's row, never add or remove anyone else's.
-- ---------------------------------------------------------------------------
create or replace function public.set_recipe_pools(p_recipe_id uuid, p_pool_ids uuid[])
returns void
language plpgsql
as $$
declare
  v_pools uuid[] := coalesce(p_pool_ids, '{}'::uuid[]);
begin
  delete from public.recipe_pool_share
  where recipe_id = p_recipe_id
    and not (pool_id = any (v_pools));

  insert into public.recipe_pool_share (recipe_id, pool_id)
  select p_recipe_id, pid
  from unnest(v_pools) pid
  on conflict (recipe_id, pool_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC updates for many-pool membership
-- ---------------------------------------------------------------------------

-- No longer refuses when the household is already pooled — you can run a
-- family pool and a friends pool side by side. Still seeds the new pool with
-- the household's current library, which is what "share my recipes" means.
create or replace function public.create_recipe_pool(p_household_id uuid, p_name text)
returns public.recipe_pool
language plpgsql
security definer
set search_path = ''
as $$
declare
  pool public.recipe_pool;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;

  insert into public.recipe_pool (name, owner_household_id)
  values (coalesce(nullif(trim(p_name), ''), 'Shared recipes'), p_household_id)
  returning * into pool;

  insert into public.recipe_pool_member (pool_id, household_id, role, joined_at)
  values (pool.id, p_household_id, 'owner', now());

  insert into public.recipe_pool_share (recipe_id, pool_id)
  select r.id, pool.id
  from public.recipe r
  where r.household_id = p_household_id
    and r.deleted_at is null
  on conflict do nothing;

  return pool;
end;
$$;

-- Joining no longer conflicts with pools you're already in; only re-joining the
-- same pool is refused. Your own library isn't auto-shared into a pool you join
-- — you pick, per recipe, on the recipe form.
create or replace function public.accept_recipe_pool_invite(p_household_id uuid, p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.recipe_pool_invite;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;

  select * into invite
  from public.recipe_pool_invite
  where code = upper(trim(p_code));

  if invite.id is null then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;

  if invite.expires_at < now() then
    raise exception 'invite code has expired' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.recipe_pool_member
    where pool_id = invite.pool_id and household_id = p_household_id
  ) then
    raise exception 'you are already in this recipe pool' using errcode = '23505';
  end if;

  insert into public.recipe_pool_member (pool_id, household_id, role, invited_at, joined_at)
  values (invite.pool_id, p_household_id, 'member', invite.created_at, now());

  update public.recipe_pool_invite
  set accepted_by = auth.uid(), accepted_at = now()
  where id = invite.id and accepted_by is null;

  return invite.pool_id;
end;
$$;

-- Leaving now also withdraws the recipes this household had shared into that
-- pool — otherwise they'd stay visible to a group you've walked away from.
create or replace function public.leave_recipe_pool(p_household_id uuid, p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.recipe_pool_member
    where pool_id = p_pool_id and household_id = p_household_id and role = 'owner'
  ) then
    raise exception 'the owner cannot leave; delete the pool instead' using errcode = '42501';
  end if;

  delete from public.recipe_pool_share s
  using public.recipe r
  where s.recipe_id = r.id
    and s.pool_id = p_pool_id
    and r.household_id = p_household_id;

  delete from public.recipe_pool_member
  where pool_id = p_pool_id and household_id = p_household_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_recipe: pool_id is gone from the row. Sharing is set separately via
-- set_recipe_pools, so editing a recipe can now change where it's shared.
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
