-- Web Push subscriptions for reminder notifications. One row per browser/device
-- (a PushSubscription: endpoint + the two keys needed to encrypt a payload).
-- The send-reminders Edge Function reads these with the service role to deliver
-- notifications; clients manage their own household's rows under RLS.
create table public.push_subscription (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null
);

create index push_subscription_household_idx on public.push_subscription (household_id);

alter table public.push_subscription enable row level security;

create policy "push_subscription: members read"
  on public.push_subscription for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "push_subscription: insert own"
  on public.push_subscription for insert
  to authenticated
  with check (public.is_household_member(household_id) and user_id = auth.uid());

create policy "push_subscription: delete own household"
  on public.push_subscription for delete
  to authenticated
  using (public.is_household_member(household_id));
