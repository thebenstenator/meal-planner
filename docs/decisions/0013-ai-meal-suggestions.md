# 0013 — AI meal suggestions ("What can I make?")

Status: accepted · Date: 2026-08-05

Ports the standalone dinner-ideas app's "give ingredients → dinner ideas" idea
into the meal-planner, wired so it can later read from the pantry (Slice 11).

## Reuse the parse-recipe infrastructure, not a new stack

`suggest-meals` is another Supabase Edge Function built exactly like
`parse-recipe`: the Anthropic key is a server secret, the call is rate-limited
per household through `consume_ai_credit` (same monthly cap), and the response is
constrained with `output_config.format` (json_schema) and re-validated with Zod,
retried once. No new auth, quota, or client-secret surface.

## Pure generation, no Spoonacular

The source app used Spoonacular for recipe matching with Claude as enricher +
fallback. We took only the **fallback** path — pure Claude generation from the
ingredient list — because it's self-contained, needs no third-party key, and is
the whole feature on its own. The warm/honest prompt (staples are free, name the
missing non-staples, force cuisine variety) is adapted from that app.

## Ideas come back in the URL-import shape, so saving is free

Each idea is emitted as `{ title, servings, prep_minutes, cook_minutes,
instructions, ingredient_lines }` — the same shape `parse-recipe-url` returns.
So "Save as recipe" calls the existing `urlImportToDetail`: the quantified
`ingredient_lines` run through the Slice 2 engine parser and Slice 3 matcher into
the same recipe-review form used by every other import. No bespoke save logic.
The extra `uses` / `missing` arrays drive the UI and "Add missing to list".

## Model: Sonnet by default (quality), configurable down

Idea generation is a creative task where quality is visible, so the default is
`claude-sonnet-4-6` (what the source app used) via `SUGGEST_MODEL`; set it to
`claude-haiku-4-5` to cut cost. This differs from `parse-recipe` (Haiku default)
because OCR extraction tolerates a cheaper model better than open-ended cooking
suggestions do.

## Add-missing targets the newest list

"Add missing to list" appends the missing ingredients as ad-hoc items to the
household's most recent shopping list, or creates a current-week list if none
exists (so the date range stays sane for month attribution). Kept deliberately
simple rather than adding a list picker.

## No CI e2e for the live call

Same as 0010/0011: the call costs money, is non-deterministic, and needs a key CI
lacks — verified manually (chicken/rice/broccoli/eggs → three varied, staple-aware
ideas with quantified lines). The save path is covered by the existing recipe/URL
e2e. `suggest-meals` must be deployed with `ANTHROPIC_API_KEY` set.
