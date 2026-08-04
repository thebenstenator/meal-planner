# 0005 — Recipes (Slice 4)

Status: accepted · Date: 2026-08-04

## Atomic save via an RPC

`save_recipe(p_recipe, p_ingredients, p_recipe_id)` upserts the recipe and
replaces its ingredient rows inside one transaction. PostgREST can't span two
tables in a single call, and the naive client approach (delete old ingredients,
then insert new) has a failure window that could leave a recipe with no
ingredients — unacceptable for "never lose a user's recipes". The function runs
as invoker, so RLS still enforces household membership on both tables.

## raw_text is sacred; parse output is advisory

Each `recipe_ingredient` stores the original line verbatim in `raw_text` and
never overwrites it. The parser's structured output (quantity/unit/canonical) is
stored alongside as editable, correctable fields. If parsing or matching is wrong,
the raw line is the audit trail and the user fixes the derived fields.

## Paste-to-parse is the primary entry path

The ingredient editor leads with a paste box: drop a recipe's ingredient list,
run the Slice 2 parser per line, then the Slice 3 matcher per line, and prefill
rows. Lines that don't match or parse with low confidence are flagged
`needs_review` so the user can fix them in two taps rather than being silently
guessed — the same "surface, don't hard-fail" principle as consolidation. Manual
row entry and an autocomplete (with create-on-the-fly) cover the rest.

## Soft delete, not hard delete

Recipes set `deleted_at` and disappear from the library but remain restorable
from "recently deleted". Nothing hard-deletes a recipe (specs/10). A future job
can purge rows past the 30-day window.

## e2e force-clicks on mobile-emulation submit buttons

Under Playwright's mobile device emulation, the actionability hit-test
intermittently reports a form field directly above a submit button as the top
element, even though the button is fully visible and clickable (verified by
screenshot). Affected submit buttons in e2e ("Create recipe", "Join household")
use `click({ force: true })` with a comment. This is a test-harness artifact, not
a UI defect — real taps land on the button.
