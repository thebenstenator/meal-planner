-- Slice 0 — Foundation
-- Enable the Postgres extensions the data model depends on. Kept in its own
-- migration so every later migration can assume they exist.

-- gen_random_uuid() for all primary keys (03-data-model.md).
create extension if not exists pgcrypto with schema extensions;

-- Trigram similarity for fuzzy canonical-ingredient matching (05-ingredient-engine.md).
-- Powers the `gin (name gin_trgm_ops)` indexes added in Slice 3.
create extension if not exists pg_trgm with schema extensions;
