-- Slice 1 — Auth & Household
-- Tenancy tables (household, household_member, household_invite), the RLS
-- membership pattern from specs/03-data-model.md, and the server-side flows for
-- auto-creating a household on signup and joining by invite code.

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.household (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  monthly_budget_cents integer check (monthly_budget_cents is null or monthly_budget_cents >= 0),
  -- FK to store is added in Slice 7 when the store table exists.
  default_store_id uuid
);

create table public.household_member (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  invited_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create index household_member_user_id_idx on public.household_member (user_id);
create index household_member_household_id_idx on public.household_member (household_id);

create table public.household_invite (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  code text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz
);

create index household_invite_household_id_idx on public.household_invite (household_id);

create trigger household_set_updated_at
  before update on public.household
  for each row execute function public.set_updated_at();

create trigger household_member_set_updated_at
  before update on public.household_member
  for each row execute function public.set_updated_at();

create trigger household_invite_set_updated_at
  before update on public.household_invite
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so RLS policies can call them without
-- recursing back through the policies on household_member itself).
-- ---------------------------------------------------------------------------
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_member m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(p_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_member m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.household enable row level security;
alter table public.household_member enable row level security;
alter table public.household_invite enable row level security;

-- household: members can read; owners can rename/update. Creation happens via
-- the signup trigger (definer); no client INSERT/DELETE.
create policy "household: members can read"
  on public.household for select
  to authenticated
  using (public.is_household_member(id));

create policy "household: owners can update"
  on public.household for update
  to authenticated
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id));

-- household_member: members can see co-members. Writes go through the signup
-- trigger and accept-invite RPC (both definer), so no client write policies.
create policy "household_member: members can read"
  on public.household_member for select
  to authenticated
  using (public.is_household_member(household_id));

-- household_invite: members can read their household's invites. Create/accept
-- go through SECURITY DEFINER RPCs below.
create policy "household_invite: members can read"
  on public.household_invite for select
  to authenticated
  using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Auto-create a household on signup and make the new user its owner.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
  household_name text;
begin
  household_name := coalesce(nullif(split_part(new.email, '@', 1), ''), 'My') || '''s Household';

  insert into public.household (name)
  values (household_name)
  returning id into new_household_id;

  insert into public.household_member (household_id, user_id, role, joined_at)
  values (new_household_id, new.id, 'owner', now());

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Invite code generation + join-by-code, as SECURITY DEFINER RPCs.
-- ---------------------------------------------------------------------------
create or replace function public.gen_invite_code()
returns text
language sql
volatile
as $$
  -- 8 chars from an unambiguous alphabet (no I/L/O/0/1).
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789',
           floor(random() * 31)::int + 1, 1),
    ''
  )
  from generate_series(1, 8);
$$;

create or replace function public.create_household_invite(p_household_id uuid)
returns public.household_invite
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
  invite public.household_invite;
  attempts int := 0;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;

  loop
    attempts := attempts + 1;
    new_code := public.gen_invite_code();
    begin
      insert into public.household_invite (household_id, code, created_by)
      values (p_household_id, new_code, auth.uid())
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

-- Members of a household, with email joined from auth.users. Guarded so only a
-- co-member can read them (auth.users is not directly readable under RLS).
create or replace function public.get_household_members(p_household_id uuid)
returns table (
  user_id uuid,
  role text,
  joined_at timestamptz,
  email text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;

  return query
  select m.user_id, m.role, m.joined_at, u.email::text
  from public.household_member m
  join auth.users u on u.id = m.user_id
  where m.household_id = p_household_id
  order by m.joined_at asc;
end;
$$;

create or replace function public.accept_household_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.household_invite;
begin
  if auth.uid() is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;

  select * into invite
  from public.household_invite
  where code = upper(trim(p_code));

  if invite.id is null then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;

  if invite.expires_at < now() then
    raise exception 'invite code has expired' using errcode = 'P0002';
  end if;

  insert into public.household_member (household_id, user_id, role, invited_at, joined_at)
  values (invite.household_id, auth.uid(), 'member', invite.created_at, now())
  on conflict (household_id, user_id) do nothing;

  update public.household_invite
  set accepted_by = auth.uid(), accepted_at = now()
  where id = invite.id and accepted_by is null;

  return invite.household_id;
end;
$$;
