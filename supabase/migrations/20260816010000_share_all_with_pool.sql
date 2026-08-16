-- Share-back: put a household's whole library into a pool it already belongs to.
--
-- Creating a pool seeds it with everything you have (see create_recipe_pool) —
-- that's what "share my recipes" means. Joining one by invite code deliberately
-- seeds nothing, because auto-publishing a stranger's library the moment they
-- type a code would be a nasty surprise. The cost of that asymmetry is that a
-- joiner's recipes silently stay out of the pool with nothing telling them so.
--
-- This is the deliberate second step: same insert create_recipe_pool runs, but
-- opt-in, for a pool you're already in. Returns how many rows it actually added
-- so the UI can say what happened.
create or replace function public.share_all_with_pool(p_household_id uuid, p_pool_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_added integer;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of this household' using errcode = '42501';
  end if;

  -- Membership is checked against the household, not just the caller: sharing
  -- pushes this household's recipes, so it's this household that must belong.
  if not exists (
    select 1 from public.recipe_pool_member
    where pool_id = p_pool_id and household_id = p_household_id
  ) then
    raise exception 'not a member of this recipe pool' using errcode = '42501';
  end if;

  insert into public.recipe_pool_share (recipe_id, pool_id)
  select r.id, p_pool_id
  from public.recipe r
  where r.household_id = p_household_id
    and r.deleted_at is null
  on conflict (recipe_id, pool_id) do nothing;

  get diagnostics v_added = row_count;
  return v_added;
end;
$$;
