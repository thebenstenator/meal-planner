-- Slice 5 — Planner
-- plan_entry: a meal placed on a day + slot. Plain `date` (no time/zone): a meal
-- is on a day, not at an instant (specs/10). leftovers/eating_out entries
-- contribute zero to the shopping list (enforced in Slice 6).

create table public.plan_entry (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  kind text not null default 'recipe'
    check (kind in ('recipe', 'leftovers', 'eating_out', 'note')),
  recipe_id uuid references public.recipe (id) on delete cascade,
  servings_override integer check (servings_override is null or servings_override > 0),
  leftovers_from_entry_id uuid references public.plan_entry (id) on delete set null,
  note text,
  position integer not null default 0,
  -- A recipe entry must point at a recipe; other kinds must not.
  check (
    (kind = 'recipe' and recipe_id is not null)
    or (kind <> 'recipe' and recipe_id is null)
  )
);

create index plan_entry_household_date_idx on public.plan_entry (household_id, date);
create index plan_entry_recipe_idx on public.plan_entry (recipe_id);

create trigger plan_entry_set_updated_at
  before update on public.plan_entry
  for each row execute function public.set_updated_at();

alter table public.plan_entry enable row level security;

create policy "plan_entry: members manage"
  on public.plan_entry for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Broadcast row changes over Supabase Realtime so a partner's edits appear live
-- (RLS still filters what each client receives).
alter publication supabase_realtime add table public.plan_entry;

-- REPLICA IDENTITY FULL so DELETE events carry every column, not just the PK.
-- Without it, a realtime subscription filtered on household_id never matches a
-- delete (the old row wouldn't include household_id) and partners wouldn't see
-- removals live.
alter table public.plan_entry replica identity full;
