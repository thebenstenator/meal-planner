-- Recipe pools — share a recipe library across households.
--
-- A pool is a co-owned "family recipe box". The owner household shares its whole
-- library into the pool; invited households join by code and can add recipes.
-- Permissions: any pool member reads all pool recipes and can add new ones;
-- members can edit only recipes they added; only the owner can delete. Shopping
-- lists, pantry and the plan are untouched — they stay household-scoped and only
-- reference recipes by id, so a pool recipe can sit in a private plan without
-- leaking anything back. Mirrors the household tenancy pattern in
-- 20260801154432_household.sql.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.recipe_pool (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  owner_household_id uuid not null references public.household (id) on delete cascade
);

create table public.recipe_pool_member (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pool_id uuid not null references public.recipe_pool (id) on delete cascade,
  household_id uuid not null references public.household (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  invited_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (pool_id, household_id),
  -- A household belongs to at most one pool (its own, or one it joined). Keeps
  -- "my pool" unambiguous — the whole feature assumes one shared box per family.
  unique (household_id)
);

create index recipe_pool_member_pool_idx on public.recipe_pool_member (pool_id);
create index recipe_pool_member_household_idx on public.recipe_pool_member (household_id);

create table public.recipe_pool_invite (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pool_id uuid not null references public.recipe_pool (id) on delete cascade,
  code text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz
);

create index recipe_pool_invite_pool_idx on public.recipe_pool_invite (pool_id);

create trigger recipe_pool_set_updated_at
  before update on public.recipe_pool
  for each row execute function public.set_updated_at();

create trigger recipe_pool_member_set_updated_at
  before update on public.recipe_pool_member
  for each row execute function public.set_updated_at();

create trigger recipe_pool_invite_set_updated_at
  before update on public.recipe_pool_invite
  for each row execute function public.set_updated_at();

-- A recipe optionally belongs to a pool; household_id stays the creator (drives
-- "edit only your own additions"). pool_id null = private household recipe.
alter table public.recipe
  add column pool_id uuid references public.recipe_pool (id) on delete set null;

create index recipe_pool_idx on public.recipe (pool_id);

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so RLS policies can call them without
-- recursing through the policies on recipe_pool_member itself).
-- ---------------------------------------------------------------------------
create or replace function public.is_pool_member(p_pool_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.recipe_pool_member pm
    join public.household_member hm on hm.household_id = pm.household_id
    where pm.pool_id = p_pool_id
      and hm.user_id = auth.uid()
  );
$$;

create or replace function public.is_pool_owner(p_pool_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.recipe_pool_member pm
    join public.household_member hm on hm.household_id = pm.household_id
    where pm.pool_id = p_pool_id
      and pm.role = 'owner'
      and hm.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security on the pool tables
-- ---------------------------------------------------------------------------
alter table public.recipe_pool enable row level security;
alter table public.recipe_pool_member enable row level security;
alter table public.recipe_pool_invite enable row level security;

-- Pool: members read; owner renames. Create/delete happen via SECURITY DEFINER
-- RPCs (no client INSERT).
create policy "recipe_pool: members read"
  on public.recipe_pool for select
  to authenticated
  using (public.is_pool_member(id));

create policy "recipe_pool: owner updates"
  on public.recipe_pool for update
  to authenticated
  using (public.is_pool_owner(id))
  with check (public.is_pool_owner(id));

create policy "recipe_pool: owner deletes"
  on public.recipe_pool for delete
  to authenticated
  using (public.is_pool_owner(id));

-- Membership + invites are readable by pool members; all writes go through RPCs.
create policy "recipe_pool_member: members read"
  on public.recipe_pool_member for select
  to authenticated
  using (public.is_pool_member(pool_id));

create policy "recipe_pool_invite: members read"
  on public.recipe_pool_invite for select
  to authenticated
  using (public.is_pool_member(pool_id));

-- ---------------------------------------------------------------------------
-- Recipe RLS — replace the single household policy with pool-aware rules.
-- ---------------------------------------------------------------------------
drop policy "recipe: members manage" on public.recipe;

create policy "recipe: read own or pool"
  on public.recipe for select
  to authenticated
  using (
    public.is_household_member(household_id)
    or (pool_id is not null and public.is_pool_member(pool_id))
  );

-- Create recipes owned by your household; if attaching to a pool, you must be a
-- member of it.
create policy "recipe: insert own"
  on public.recipe for insert
  to authenticated
  with check (
    public.is_household_member(household_id)
    and (pool_id is null or public.is_pool_member(pool_id))
  );

-- The creator household edits its own recipes (private or its pool additions);
-- the pool owner may edit anything in the pool. Delete (deleted_at) is carved
-- back to owner-only by the trigger below.
create policy "recipe: update own or pool-owner"
  on public.recipe for update
  to authenticated
  using (
    public.is_household_member(household_id)
    or (pool_id is not null and public.is_pool_owner(pool_id))
  )
  with check (
    public.is_household_member(household_id)
    or (pool_id is not null and public.is_pool_owner(pool_id))
  );

create policy "recipe: delete own household"
  on public.recipe for delete
  to authenticated
  using (public.is_household_member(household_id));

-- Only the pool owner may soft-delete or restore a pool recipe. Soft delete is
-- an UPDATE of deleted_at, which the update policy would otherwise let a member
-- do to their own addition — this carves that out. Private recipes (pool_id
-- null) are unaffected: creators still soft-delete their own.
create or replace function public.enforce_pool_recipe_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pool_id is not null
     and new.deleted_at is distinct from old.deleted_at
     and not public.is_pool_owner(new.pool_id) then
    raise exception 'only the pool owner can delete pool recipes'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger recipe_enforce_pool_delete
  before update on public.recipe
  for each row execute function public.enforce_pool_recipe_delete();

-- ---------------------------------------------------------------------------
-- recipe_ingredient RLS — widen to pool visibility, matching recipe rules.
-- ---------------------------------------------------------------------------
drop policy "recipe_ingredient: members manage" on public.recipe_ingredient;

create policy "recipe_ingredient: read visible"
  on public.recipe_ingredient for select
  to authenticated
  using (
    exists (
      select 1 from public.recipe r
      where r.id = recipe_id
        and (
          public.is_household_member(r.household_id)
          or (r.pool_id is not null and public.is_pool_member(r.pool_id))
        )
    )
  );

create policy "recipe_ingredient: write editable"
  on public.recipe_ingredient for all
  to authenticated
  using (
    exists (
      select 1 from public.recipe r
      where r.id = recipe_id
        and (
          public.is_household_member(r.household_id)
          or (r.pool_id is not null and public.is_pool_owner(r.pool_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.recipe r
      where r.id = recipe_id
        and (
          public.is_household_member(r.household_id)
          or (r.pool_id is not null and public.is_pool_owner(r.pool_id))
        )
    )
  );

-- ---------------------------------------------------------------------------
-- RPCs (SECURITY DEFINER; guard membership). Mirror the household invite flow.
-- ---------------------------------------------------------------------------

-- Create a pool from the caller's household and share its whole live library
-- into it. Fails if the household is already in a pool.
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

  if exists (select 1 from public.recipe_pool_member where household_id = p_household_id) then
    raise exception 'this household is already in a recipe pool' using errcode = '23505';
  end if;

  insert into public.recipe_pool (name, owner_household_id)
  values (coalesce(nullif(trim(p_name), ''), 'Shared recipes'), p_household_id)
  returning * into pool;

  insert into public.recipe_pool_member (pool_id, household_id, role, joined_at)
  values (pool.id, p_household_id, 'owner', now());

  -- The whole library becomes the pool: share every live recipe the household
  -- already has. Future recipes attach via the client passing pool_id.
  update public.recipe
  set pool_id = pool.id
  where household_id = p_household_id
    and deleted_at is null
    and pool_id is null;

  return pool;
end;
$$;

create or replace function public.create_recipe_pool_invite(p_pool_id uuid)
returns public.recipe_pool_invite
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
  invite public.recipe_pool_invite;
  attempts int := 0;
begin
  if not public.is_pool_member(p_pool_id) then
    raise exception 'not a member of this pool' using errcode = '42501';
  end if;

  loop
    attempts := attempts + 1;
    new_code := public.gen_invite_code();
    begin
      insert into public.recipe_pool_invite (pool_id, code, created_by)
      values (p_pool_id, new_code, auth.uid())
      returning * into invite;
      return invite;
    exception when unique_violation then
      if attempts >= 5 then
        raise exception 'could not generate a unique invite code';
      end if;
    end;
  end loop;
end;
$$;

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

  if exists (select 1 from public.recipe_pool_member where household_id = p_household_id) then
    raise exception 'this household is already in a recipe pool' using errcode = '23505';
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

  insert into public.recipe_pool_member (pool_id, household_id, role, invited_at, joined_at)
  values (invite.pool_id, p_household_id, 'member', invite.created_at, now());

  update public.recipe_pool_invite
  set accepted_by = auth.uid(), accepted_at = now()
  where id = invite.id and accepted_by is null;

  return invite.pool_id;
end;
$$;

-- Member households of a pool, with the owner-user's email joined from
-- auth.users (which the client cannot read directly under RLS).
create or replace function public.get_recipe_pool_members(p_pool_id uuid)
returns table (
  household_id uuid,
  household_name text,
  role text,
  joined_at timestamptz,
  email text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_pool_member(p_pool_id) then
    raise exception 'not a member of this pool' using errcode = '42501';
  end if;

  return query
  select
    pm.household_id,
    h.name,
    pm.role,
    pm.joined_at,
    (
      select u.email::text
      from public.household_member hm
      join auth.users u on u.id = hm.user_id
      where hm.household_id = pm.household_id
      order by (hm.role = 'owner') desc, hm.joined_at asc
      limit 1
    )
  from public.recipe_pool_member pm
  join public.household h on h.id = pm.household_id
  where pm.pool_id = p_pool_id
  order by pm.joined_at asc;
end;
$$;

-- A member household leaves the pool. The owner cannot leave — they delete the
-- pool instead (which unshares every recipe via the FK on delete set null).
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

  delete from public.recipe_pool_member
  where pool_id = p_pool_id and household_id = p_household_id;
end;
$$;

create or replace function public.delete_recipe_pool(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_pool_owner(p_pool_id) then
    raise exception 'only the pool owner can delete the pool' using errcode = '42501';
  end if;

  -- recipe.pool_id is ON DELETE SET NULL, so recipes fall back to private.
  delete from public.recipe_pool where id = p_pool_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_recipe: carry pool_id on create; never change it on update (a member
-- can't yank a recipe out of the pool). Otherwise identical to the original.
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
      household_id, pool_id, title, description, meal_types, servings,
      prep_minutes, cook_minutes, instructions, source, tags, notes, rating
    )
    values (
      (p_recipe->>'household_id')::uuid,
      (p_recipe->>'pool_id')::uuid,
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
