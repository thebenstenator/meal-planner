-- Slice 3 — Canonical Ingredients
-- The deduplication key for the whole product. Global seed rows (household_id
-- null) are shared reference data; households may add their own rows and learn
-- their own raw-name -> canonical mappings.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.canonical_ingredient (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- null => global/seed row shared by everyone.
  household_id uuid references public.household (id) on delete cascade,
  name text not null,
  aliases text[] not null default '{}',
  category text,
  default_unit text,
  density_g_per_ml numeric,
  unit_size_quantity numeric,
  unit_size_unit text,
  count_to_gram numeric,
  -- soft-merge target: this row is an alias of merged_into_id.
  merged_into_id uuid references public.canonical_ingredient (id) on delete set null,
  check (household_id is not null or merged_into_id is null)
);

create trigger canonical_ingredient_set_updated_at
  before update on public.canonical_ingredient
  for each row execute function public.set_updated_at();

-- Fuzzy-match indexes (specs/05 step 3). GIN over trigrams of the name, plus a
-- GIN over the aliases array for exact alias membership.
create index canonical_ingredient_name_trgm_idx
  on public.canonical_ingredient using gin (name gin_trgm_ops);
create index canonical_ingredient_aliases_idx
  on public.canonical_ingredient using gin (aliases);
create index canonical_ingredient_household_idx
  on public.canonical_ingredient (household_id);

-- Household-learned mappings: once a household maps a raw line to a canonical
-- ingredient, reuse it. These compound in value over time (specs/05).
create table public.household_ingredient_map (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  household_id uuid not null references public.household (id) on delete cascade,
  raw_name text not null,
  canonical_ingredient_id uuid not null references public.canonical_ingredient (id) on delete cascade,
  unique (household_id, raw_name)
);

create trigger household_ingredient_map_set_updated_at
  before update on public.household_ingredient_map
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.canonical_ingredient enable row level security;
alter table public.household_ingredient_map enable row level security;

-- Everyone authenticated can read global rows; members also read their own.
create policy "canonical: read global or own"
  on public.canonical_ingredient for select
  to authenticated
  using (household_id is null or public.is_household_member(household_id));

-- Clients may only create/edit household-scoped rows. Global seed rows are
-- reference data, mutated by migrations only.
create policy "canonical: insert own household rows"
  on public.canonical_ingredient for insert
  to authenticated
  with check (household_id is not null and public.is_household_member(household_id));

create policy "canonical: update own household rows"
  on public.canonical_ingredient for update
  to authenticated
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

create policy "ingredient map: members manage"
  on public.household_ingredient_map for all
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Matching (specs/05 step 3): exact -> alias -> household-learned -> trigram.
-- LLM disambiguation (step 5) is deferred to Slice 9. Runs as invoker so RLS
-- naturally limits visibility to global + own-household rows.
-- ---------------------------------------------------------------------------

-- Follow a soft-merge chain to the surviving canonical id (bounded hops).
create or replace function public.resolve_canonical(p_id uuid)
returns uuid
language plpgsql
stable
as $$
declare
  cur uuid := p_id;
  nxt uuid;
  hops int := 0;
begin
  loop
    select merged_into_id into nxt from public.canonical_ingredient where id = cur;
    exit when nxt is null;
    cur := nxt;
    hops := hops + 1;
    exit when hops >= 10;
  end loop;
  return cur;
end;
$$;

-- Minimum trigram similarity, and how clearly the best must beat the runner-up.
create or replace function public.match_canonical_ingredient(
  p_household_id uuid,
  p_raw text,
  p_threshold numeric default 0.45
)
returns table (
  canonical_ingredient_id uuid,
  name text,
  method text,
  score numeric
)
language plpgsql
stable
as $$
declare
  v_raw text := lower(trim(coalesce(p_raw, '')));
  v_id uuid;
  v_top_id uuid;
  v_top_sim numeric;
  v_second_sim numeric;
begin
  if v_raw = '' then
    return;
  end if;

  -- 1. Household-learned mapping (exact raw line seen before).
  select m.canonical_ingredient_id into v_id
  from public.household_ingredient_map m
  where m.household_id = p_household_id and lower(m.raw_name) = v_raw
  limit 1;
  if v_id is not null then
    v_id := public.resolve_canonical(v_id);
    return query
      select c.id, c.name, 'learned'::text, 1.0::numeric
      from public.canonical_ingredient c where c.id = v_id;
    return;
  end if;

  -- 2. Exact name match (prefer a household override over the global row).
  select c.id into v_id
  from public.canonical_ingredient c
  where c.merged_into_id is null
    and (c.household_id = p_household_id or c.household_id is null)
    and lower(c.name) = v_raw
  order by (c.household_id is not null) desc
  limit 1;
  if v_id is not null then
    return query
      select c.id, c.name, 'exact'::text, 1.0::numeric
      from public.canonical_ingredient c where c.id = v_id;
    return;
  end if;

  -- 3. Exact alias match.
  select c.id into v_id
  from public.canonical_ingredient c
  where c.merged_into_id is null
    and (c.household_id = p_household_id or c.household_id is null)
    and exists (
      select 1 from unnest(c.aliases) a where lower(a) = v_raw
    )
  order by (c.household_id is not null) desc
  limit 1;
  if v_id is not null then
    return query
      select c.id, c.name, 'alias'::text, 1.0::numeric
      from public.canonical_ingredient c where c.id = v_id;
    return;
  end if;

  -- 4. Trigram similarity across name + aliases; take the best only if it
  -- clears the threshold and clearly beats the runner-up.
  with scored as (
    select
      c.id as cid,
      greatest(
        similarity(lower(c.name), v_raw),
        coalesce((select max(similarity(lower(a), v_raw)) from unnest(c.aliases) a), 0)
      ) as sim
    from public.canonical_ingredient c
    where c.merged_into_id is null
      and (c.household_id = p_household_id or c.household_id is null)
  ),
  ranked as (
    select cid, sim, row_number() over (order by sim desc, cid asc) as rn
    from scored
  )
  select
    (select cid from ranked where rn = 1),
    (select sim from ranked where rn = 1),
    (select sim from ranked where rn = 2)
  into v_top_id, v_top_sim, v_second_sim;

  if v_top_id is not null
     and v_top_sim >= p_threshold
     and (v_second_sim is null or v_top_sim >= 0.7 or (v_top_sim - v_second_sim) >= 0.05)
  then
    return query
      select c.id, c.name, 'trigram'::text, round(v_top_sim, 4)
      from public.canonical_ingredient c where c.id = v_top_id;
    return;
  end if;

  -- 5. No confident match.
  return;
end;
$$;
