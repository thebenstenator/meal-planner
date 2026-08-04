# 0010 — AI recipe import (Slice 9)

Status: accepted · Date: 2026-08-04

## The Anthropic key lives only in the Edge Function

All Claude calls go through the `parse-recipe` Supabase Edge Function; the key is
a Supabase secret, never in the client bundle or Vercel env. The client sends
base64 images + household_id with the user's JWT; the function authenticates,
rate-limits, calls Claude, validates, and returns JSON.

## Structured outputs, not tool use

The function constrains Claude's response with `output_config.format`
(json_schema) rather than forcing a tool call. For pure extraction this is
simpler and guarantees a schema-conformant object, which we then re-validate with
Zod and retry once on failure — never trusting the model output raw (specs/10).

## Model: Haiku 4.5 by default, configurable

Recipe OCR is a well-scoped extraction task, so the default is `claude-haiku-4-5`
(~5× cheaper than Opus) via `RECIPE_PARSE_MODEL`. Switch to `claude-opus-4-8` for
messy handwriting or dense multi-column pages by setting that env var — no code
change.

## Rate limiting is server-side and atomic

`consume_ai_credit(household_id, limit)` upserts a monthly counter row and
increments it under `for update`, returning the remaining credits or -1 when over
the cap. The function checks the return before calling Claude. Enforced in the
database, not the client (specs/10: never trust the client for quota).

## Review is mandatory; it reuses the recipe form

The parsed recipe doesn't auto-save (specs/10: never auto-save AI output). It
opens in the existing Slice 4 recipe form, pre-filled, with each ingredient run
through the Slice 3 matcher and low-confidence / unmatched rows badged for
review. Saving goes through the same `save_recipe` path as manual entry.

## No CI e2e for the live parse

The Claude call costs money, is non-deterministic, and needs a key CI doesn't
have — so there's no automated end-to-end test of the parse itself. The review →
save half is already covered by the Slice 4 recipe e2e; the parse is verified
manually against real photos. The `parse-recipe` function must be deployed
(`supabase functions deploy parse-recipe`) with `ANTHROPIC_API_KEY` set as a
secret before the feature works in production.

## Image storage deferred

The fallback path routes to manual entry but doesn't yet persist the photo to
Supabase Storage (`recipe.image_path` stays null). Attaching the source image is
a small follow-up; it doesn't block the parse → review → save loop.
