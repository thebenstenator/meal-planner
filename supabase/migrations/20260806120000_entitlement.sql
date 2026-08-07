-- Monetization Phase 0 — entitlement + server-side AI tiering.
-- We gate only the AI "smart" features: free vs premium monthly AI caps are
-- resolved in the meter itself, from the household's is_premium flag, so the
-- client can never grant itself more credits.
--
-- During the pre-launch testing period is_premium DEFAULTS TO TRUE, so every
-- tester (and anyone they invite) is grandfathered/free. At launch: flip the
-- default to false (`alter ... set default false`) — existing rows stay true and
-- are grandfathered permanently; new signups become free-tier.
alter table public.household
  add column is_premium boolean not null default true;

-- One row per metered Claude call, so spend is reconstructable (source -> model
-- -> cost). The monthly counter only gives totals.
create table public.ai_call_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  source text not null
);
create index ai_call_log_household_idx on public.ai_call_log (household_id, created_at);
alter table public.ai_call_log enable row level security;
create policy "ai_call_log: members read"
  on public.ai_call_log for select
  to authenticated
  using (public.is_household_member(household_id));

-- Re-tier the meter off entitlement. p_limit is kept (ignored) so already-deployed
-- functions that still pass it don't break during the deploy window; the real cap
-- comes from is_premium. p_source is logged for cost attribution.
drop function if exists public.consume_ai_credit(uuid, integer);
create function public.consume_ai_credit(
  p_household_id uuid,
  p_limit integer default null,
  p_source text default 'ai'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period text := to_char(now(), 'YYYY-MM');
  v_count integer;
  v_limit integer;
  v_premium boolean;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;

  select is_premium into v_premium from public.household where id = p_household_id;
  -- Free = 5/month (a taste of the magic); premium = a high cap that still guards
  -- against abuse. Change here (one migration) to re-tune.
  v_limit := case when coalesce(v_premium, false) then 200 else 5 end;

  insert into public.ai_usage_counter (household_id, period, count)
  values (p_household_id, v_period, 0)
  on conflict (household_id, period) do nothing;

  select count into v_count
  from public.ai_usage_counter
  where household_id = p_household_id and period = v_period
  for update;

  if v_count >= v_limit then
    return -1;
  end if;

  update public.ai_usage_counter
  set count = count + 1
  where household_id = p_household_id and period = v_period;

  insert into public.ai_call_log (household_id, source) values (p_household_id, p_source);

  return v_limit - (v_count + 1);
end;
$$;
