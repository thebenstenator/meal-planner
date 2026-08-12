# 0014 — Shopping list categories

Status: accepted · Date: 2026-08-12

## The item keeps a slug; the household owns the registry

`shopping_list_item.category` was already a free-text string (copied from the
canonical ingredient at generation time). Rather than replace it with a foreign
key, the new `shopping_category` table is a *registry* of those slugs per
household — display name, aisle order, and which ones exist at all — joined by
slug in the client.

That keeps `generate_shopping_list` and every existing write path untouched (no
FK to resolve, no backfill of historical items), and it makes an unknown slug a
non-event: anything the household doesn't have a category for renders in the
fallback bucket instead of vanishing. The cost is that the database can't
enforce referential integrity on the slug — accepted, because the failure mode
is cosmetic and self-healing.

## Every household gets the same starter set, seeded server-side

A trigger on `household` insert seeds 17 default sections in store-walk order
(produce → … → other), and the migration backfills existing households. The list
is mirrored in `src/features/shopping-list/categories.ts` for two reasons: the
client needs it as a render placeholder before the query resolves, and it can
re-seed a household that somehow has none. The seeding functions are
`security definer` with execute revoked from `authenticated`, so they're
reachable only from the trigger — never as an RPC against another household.

## "Other" is a real row, and it is not deletable

Every item needs somewhere to land, so the fallback bucket exists as a row
(renameable — some people call it "Misc") protected by the delete policy, not by
UI convention. It's also pinned last in the aisle order: reordering skips it.

## Deletion reassigns rather than orphans

`delete_shopping_category` moves the household's items, ingredient overrides and
household-owned canonical rows off the slug before deleting the row, in one
transaction. Without it, deleting "Snacks" and later re-creating it would
resurrect the old contents — surprising, and hard to explain.

## Deduction is precision-first, with a floor

`guessCategory` still returns `null` when it isn't confident (a wrong category
on a canonical ingredient leaks into the pantry and "what can I make?" seeds).
Shopping items can't be null-categorized, so `deduceCategory` wraps it and falls
back to `other`. Two aisle *modifiers* — "frozen …" and "canned …" — are checked
before the ingredient rules, because that's where the store keeps them: "frozen
peas" is frozen, not produce.

## A recategorized item stays put across regeneration

Moving an item to another category writes the item row *and*, when the item is
backed by a canonical ingredient, an entry in `household_ingredient_category`.
Generation applies those overrides over the ingredient's own category, so a
regenerate doesn't undo the shopper's filing. This is also the household-override
mechanism that 0007 deferred for global seed rows, scoped to category only:
global canonical rows stay read-only, the override lives in the household's own
table.
