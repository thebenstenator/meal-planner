-- Smart pantry — low-stock suggestions. When an item runs low it's suggested for
-- restock on the shopping list; dismissing it sets restock_muted so it stops
-- nagging. Buying more of it (a positive stock adjustment) clears the mute so it
-- can suggest again next time it runs low.
alter table public.pantry_item
  add column restock_muted boolean not null default false;
