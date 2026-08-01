# 0003 — Ingredient engine design (Slice 2)

Status: accepted · Date: 2026-08-01

The engine (`src/lib/ingredients/`) is the product. Decisions that shaped it:

## Matching lives outside this module

specs/05 lists a MATCH step (raw name → canonical_ingredient_id) between
normalize and convert. That step needs `pg_trgm` and the household-learned
mapping table — i.e. the database — so it belongs with Slice 3, not here. The
engine instead accepts an already-assigned `canonicalId` per line plus a
`CanonicalInfo` lookup for the conversion facts it needs (density, count_to_gram,
default unit, package size). This keeps the module pure and DB-free, and makes
it trivially testable.

## Deterministic parser only (Tier 1); LLM fallback deferred

specs/05 describes a two-tier parser: a deterministic tokenizer for the ~85%
common case, and an LLM fallback for low-confidence lines. Only Tier 1 is built
here — it's pure, free, offline, and testable. Each parse carries a `confidence`
score; the LLM fallback (Slice 9's Edge Function) will consume lines below a
threshold. The parser never throws and always returns a name, so a low-confidence
result still degrades gracefully.

## Conversion bridges through grams; refuses rather than guesses

Same-dimension conversions (mass↔mass, volume↔volume) are pure factor math and
always safe. Cross-dimension conversions bridge through grams and require the
relevant fact: density for volume↔mass, count_to_gram for count↔mass. When the
fact is missing, `convert` returns `{ ok: false, reason }` and consolidation
marks the item `unresolved` with per-unit subtotals. **The unresolved path is a
feature** (specs/05): the UI will offer "set a conversion", which writes back to
the canonical ingredient so it never asks again.

## Target-unit selection

Within a group, the target unit is the canonical's `default_unit` if every member
converts to it; otherwise the unit of the largest-quantity member. "Largest" is
compared via each unit's base factor (ml/g) so same-dimension members rank
correctly without needing density.

## Parenthetical package sizes multiply out

"1 (8 oz) package cream cheese" and "1 package (16 oz) frozen peas" both resolve
to the inner measure (8 oz, 16 oz) when the outer unit is a container
(can/package/box/bag/jar/…). "2 (14 oz) cans" → 28 oz. A parenthetical that isn't
a measure ("about 3") is ignored for quantity. This is what makes cross-recipe
consolidation actually work on real cookbook lines.

## Fixtures are the regression net

215 real ingredient lines are snapshot-tested (`parse-fixtures.test.ts`). Per
specs/05: no consolidation/parse bug ships without a fixture added first, so
every fix is permanent.
