-- Monetization Phase 1 — the signals auto-fill ranks on: favorites, most-cooked,
-- and haven't-made-in-a-while. times_cooked/last_cooked_on already exist on
-- recipe but weren't maintained; a trigger now keeps them in sync with the
-- planner's cooked toggle. Plus a simple favorite flag.

alter table public.recipe
  add column is_favorite boolean not null default false;

-- Maintain recipe cook stats whenever a planned meal's cooked_at flips. Accurate
-- both ways: cooking bumps the count + last-cooked date; un-cooking decrements and
-- recomputes last-cooked from the remaining cooked entries.
create or replace function public.maintain_recipe_cook_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.recipe_id is null then
    return new;
  end if;

  if old.cooked_at is null and new.cooked_at is not null then
    update public.recipe
    set times_cooked = times_cooked + 1,
        last_cooked_on = greatest(coalesce(last_cooked_on, new.date), new.date)
    where id = new.recipe_id;
  elsif old.cooked_at is not null and new.cooked_at is null then
    update public.recipe r
    set times_cooked = greatest(0, times_cooked - 1),
        last_cooked_on = (
          select max(pe.date)
          from public.plan_entry pe
          where pe.recipe_id = r.id and pe.cooked_at is not null and pe.id <> new.id
        )
    where r.id = new.recipe_id;
  end if;

  return new;
end;
$$;

create trigger plan_entry_cook_stats
  after update of cooked_at on public.plan_entry
  for each row
  execute function public.maintain_recipe_cook_stats();
