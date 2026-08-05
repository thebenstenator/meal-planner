-- Smart pantry Phase 3 — mark a planned meal cooked. cooked_at is the idempotent
-- guard: setting it decrements the recipe's ingredients from the pantry once,
-- clearing it adds them back. Nullable; only recipe entries are ever cooked.
alter table public.plan_entry add column cooked_at timestamptz;
