-- Pantry: distinguish "I have this, amount unknown" from a quantified 0.
-- When someone bulk-adds or quick-adds an item without typing an amount, we now
-- record amount_unknown = true (quantity stays 0). Consumers treat unknown items
-- as "on hand": the shopping list won't re-suggest them, and low-stock skips them
-- (you can't be "low" on an amount you never measured). This stops unquantified
-- pantry items from bloating the generated list. A quantified 0 still means "out"
-- (e.g. cooked down to empty) and is re-suggested as before.
alter table public.pantry_item
  add column amount_unknown boolean not null default false;

comment on column public.pantry_item.amount_unknown is
  'True when the item is on hand but its amount was never quantified. Such rows are treated as fully in stock (skipped by list generation and low-stock).';
