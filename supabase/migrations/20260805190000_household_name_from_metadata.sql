-- Name the auto-created household after the person's name (collected at signup as
-- full_name metadata) instead of the email local part. Falls back to the email
-- prefix, then "My", when no name was given.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household_id uuid;
  household_name text;
  base_name text;
begin
  base_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'My'
  );
  household_name := base_name || '''s Household';

  insert into public.household (name)
  values (household_name)
  returning id into new_household_id;

  insert into public.household_member (household_id, user_id, role, joined_at)
  values (new_household_id, new.id, 'owner', now());

  return new;
end;
$$;
