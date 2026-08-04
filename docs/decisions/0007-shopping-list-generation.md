# 0007 — Shopping list generation (Slice 6)

Status: accepted · Date: 2026-08-04

## The engine runs client-side; the RPC only persists

The consolidation engine is pure TypeScript (Slice 2), so generation runs in the
client: fetch the plan's recipe ingredients + canonical conversion facts, call
`consolidate()`, then hand the finished items to `generate_shopping_list` as
jsonb. The RPC does no math — it just persists atomically (list + items +
sources) in one transaction. This avoids reimplementing the engine in SQL/Deno
and keeps a single source of truth for consolidation.

## leftovers / eating_out / note contribute nothing

Generation queries plan entries with `kind = 'recipe'`. The other kinds are
stored precisely so they *don't* add to the list — they explain the gaps in a
month of dinners. Enforced by the query, not by post-filtering.

## Unmatched ingredients still consolidate

Ingredients without a canonical match are grouped by a synthetic key
(`unmatched:<cleaned name>`) and run through the same engine, so identical raw
names across recipes still merge (and split by unit when needed). They persist
with `canonical_ingredient_id = null` and are flagged "unmatched" so the user can
fix them in the recipe editor.

## Regeneration preserves human edits

`generate_shopping_list(..., p_list_id)` snapshots `is_checked` by key
(canonical id / ad-hoc name / display name) and carries it onto the regenerated
items, and it only deletes generated rows — `is_manual` items (ad-hoc additions)
survive. So regenerating after a plan change doesn't lose check-off state or
hand-added items.

## Conversion write-back is limited to household-owned canonicals

"Set conversion" writes a density back to the canonical ingredient and
regenerates so the item merges (specs/05: "gets smarter with use"). RLS makes
global seed rows read-only, so write-back only works for household-owned
canonicals — which is exactly where unresolved cases arise (user-created
ingredients without a density). Global staples already ship with densities. A
household-override mechanism for global rows is a future enhancement.

## Manual quantity override is intentionally ephemeral

Overriding an item's quantity edits the row directly; a later regenerate
recomputes it from the plan. That's the expected behavior — the plan is the
source of truth, and the override is a quick in-store correction.
