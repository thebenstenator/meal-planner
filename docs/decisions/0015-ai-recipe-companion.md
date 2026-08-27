# 0015 — AI recipe companion (ask + edit, while you cook)

Status: proposed · Date: 2026-08-18

A premium, in-the-moment assistant on a recipe: ask questions about it ("can I
use yogurt instead of buttermilk?", "how do I know the salmon's done?", "make
this dairy-free") or have it propose specific edits ("halve the sugar", "convert
to metric", "add a resting step"). Bound to the one recipe you're looking at —
it's a *recipe* companion, not a chat tab.

## Reuse the AI edge-function stack, add nothing new

`recipe-companion` is another Supabase Edge Function built exactly like
`suggest-meals` / `parse-recipe`: Anthropic key stays a server secret, metered
per household through `consume_ai_credit` on the caller's JWT (same monthly cap,
free-vs-premium resolved server-side), CORS + Zod as elsewhere. No new auth,
quota, or client-secret surface. Premium feature — gate AI only (08).

## Two modes, one panel

The panel is seeded with the full recipe in view (title, ingredient lines +
quantities, instructions, servings) as context, so there's no ingredient-picking
step. Request carries `mode: 'ask' | 'edit'` plus the (trimmed) conversation:

- **`ask` → streaming (SSE) plain text.** Long answers must show progress; on a
  phone a multi-second silent wait reads as broken. Client consumes the stream
  via fetch. No writes, ever.
- **`edit` → structured output** (`output_config.format` json_schema, Zod-
  validated + retried once, same as `suggest-meals`). Returns a *proposed patch*,
  never prose and never a write.

## The hard constraint: never silently mutate a recipe

Non-negotiable #4 (never lose a user's recipes) and the standing "never
auto-save AI output" principle. So an `edit` is a **proposal**, rendered as a
before/after diff, applied only on the user's choice:

- **Try it for this cook** — an ephemeral overlay, like servings-scaling today;
  nothing persisted, no write permission needed. This is the cooking-time
  default.
- **Save to the recipe** — routes through the *existing* recipe-review/edit form
  and save path, inheriting cookbook/ownership permissions and validation. AI
  proposes; a human commits through the same door as a manual edit, so a shared
  household recipe can't be corrupted by one member's AI whim.

## Reuse, don't reinvent — and don't spend a credit on arithmetic

- **Deterministic scaling stays deterministic and free.** "Scale to 6 servings"
  already exists (recipe-scaling, exact). The `edit` schema can return a `scale`
  intent that the client hands to the existing scaler rather than a Claude patch
  — no credit, no arithmetic drift. AI is for the fuzzy asks (substitutions,
  rewrites, unit conversion with sane rounding, dietary transforms).
- **Persisted edits land in the RecipeDetail shape** (`ingredient_lines` → engine
  parser → matcher → review form), so "Save" reuses the import assembly
  (`urlImportToDetail`-style) and is free. No bespoke save logic — the 0013 move.

## Model: Haiku by default, escalate if needed

`COMPANION_MODEL` defaults to `claude-haiku-4-5`. Q&A and edits here reason over a
recipe that's *provided in context* — extraction/transform, not open-ended
generation — which Haiku does well and cheaply. Escalate to `claude-sonnet-4-6`
if substitution quality proves weak. (Contrast 0013, where open-ended idea
*generation* justified Sonnet by default; here the recipe is given.)

**Prompt-cache the system prompt + recipe context.** They're stable across a
conversation and are the bulk of the tokens; caching them cuts the cost of
multi-turn chats to roughly the growing history. Trim history to a small window —
the recipe, cached, carries the context, not a long transcript.

## System-prompt guardrails

- Stay grounded in the provided recipe; never invent ingredients or steps it
  doesn't contain when answering "what's in this / what do I do next".
- Be honest about **food safety** — don't green-light undercooked poultry to save
  time. People act on this mid-cook.
- For edits: return the *smallest* change that satisfies the ask, preserve the
  user's instruction voice/format, and quantify substitutions.

## Metering — recommended per-request, session-credit left open

The meter is per-household-per-month, and a chat has many turns, so this needs a
call:

- **Recommended:** one credit per user question/edit request (one assistant turn
  = one Claude call = one unit); premium gets the high/unlimited cap like every
  other AI feature. Simplest, consistent, server stays the source of truth.
- **Open, revisit with data (like the payment model in 08):** a *session* credit
  — opening the companion buys a window of follow-ups for one credit — if
  per-request proves too stingy against the free 3–5-credit monthly taste.
- Ephemeral "try it for this cook" scaling is routed to the deterministic scaler
  and is **free** (no Claude call), same as manual scaling.

## Free vs premium, and offline

Premium, under the AI cap. Free users reach it through the monthly taste
allowance so they feel the magic once; premium gets the high cap (08). Like every
AI feature it needs network, so the companion is simply **unavailable offline** —
viewing the recipe, deterministic scaling, and check-off stay offline-first.
Surface that rather than let it look broken in an aisle.

## Why it belongs in the "recurring hooks" (08)

Import is front-loaded — done once, weak retention. The companion recurs with
*cooking frequency*: a swap mid-recipe, a doneness check, a "make it lighter" —
every unfamiliar cook. That's the recurring, ambient value the monetization doc
says a *subscription* (not a one-time unlock) needs. Add it to the recurring-hooks
list when this is accepted.

## Testing

Per 0010/0011/0013: no CI e2e for the live call (costs money, non-deterministic,
needs a key CI lacks) — verify manually. What *is* deterministic gets covered:
the `scale`-intent routing to the existing scaler, and the proposal → review-form
→ save wiring (which already has recipe-edit e2e behind it). `recipe-companion`
must be deployed with `ANTHROPIC_API_KEY` set.

## Open questions

- **Metering granularity** — per-request vs session credit (above).
- **Conversation cost** — watch long chats even with caching + Haiku; the
  per-call cost log (08, "log every AI call") is the instrument.
- **Persisted vs ephemeral default** — cooking-time leans ephemeral; confirm the
  "Save to recipe" affordance is discoverable enough without nudging people into
  accidental writes to shared recipes.
