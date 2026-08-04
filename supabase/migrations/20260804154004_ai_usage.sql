-- Slice 9 — AI Recipe Import: per-household rate limiting + usage counter.
-- Cost control for the paid Claude vision calls (specs/07 Slice 9).

create table public.ai_usage_counter (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  -- Billing period, YYYY-MM. One counter row per household per month.
  period text not null,
  count integer not null default 0,
  unique (household_id, period)
);

create trigger ai_usage_counter_set_updated_at
  before update on public.ai_usage_counter
  for each row execute function public.set_updated_at();

alter table public.ai_usage_counter enable row level security;

-- Members can see their own usage; writes go through the SECURITY DEFINER RPC.
create policy "ai_usage: members read"
  on public.ai_usage_counter for select
  to authenticated
  using (public.is_household_member(household_id));

-- Atomically consume one AI credit for the household's current month, enforcing
-- a monthly cap. Returns the remaining credits, or -1 when over the limit (the
-- caller must not proceed). SECURITY DEFINER so it can upsert the counter under
-- RLS; membership is checked explicitly.
create or replace function public.consume_ai_credit(p_household_id uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period text := to_char(now(), 'YYYY-MM');
  v_count integer;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;

  insert into public.ai_usage_counter (household_id, period, count)
  values (p_household_id, v_period, 0)
  on conflict (household_id, period) do nothing;

  select count into v_count
  from public.ai_usage_counter
  where household_id = p_household_id and period = v_period
  for update;

  if v_count >= p_limit then
    return -1;
  end if;

  update public.ai_usage_counter
  set count = count + 1
  where household_id = p_household_id and period = v_period;

  return p_limit - (v_count + 1);
end;
$$;
