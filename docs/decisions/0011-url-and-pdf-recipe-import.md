# 0011 — URL and PDF recipe import

Status: accepted · Date: 2026-08-04

Extends Slice 9 (see 0010) with two more ways in: a website link and a PDF.

## PDF rides the existing parse-recipe function

A PDF is just another Claude source block. The `parse-recipe` function branches
on `media_type`: `application/pdf` becomes a `document` block, everything else
stays an `image` block. Same schema, same Zod validation, same rate limit, same
review screen — no second function, no client changes beyond accepting
`application/pdf` in the file input. Claude reads native PDF (text + page
images), so multi-page recipes work without us rasterizing anything.

## URL import fetches server-side, JSON-LD first, Claude only as fallback

Browsers can't fetch an arbitrary recipe site (CORS), so `parse-recipe-url`
fetches the page from the Edge Function. Most recipe sites embed
`schema.org/Recipe` as JSON-LD — structured, exact, and free. So the function
reads JSON-LD first (walking `@graph`/arrays, decoding entities, parsing ISO-8601
durations and `recipeYield`) and **only** calls Claude when there's no usable
JSON-LD. That keeps the common case off the AI budget entirely.

## The credit is charged only on the AI fallback

`consume_ai_credit` runs **after** the JSON-LD attempt fails, not before the
fetch. A JSON-LD hit returns `usedAi: false` and costs no credit; the Claude
fallback returns `usedAi: true` and decrements the monthly counter. Quota is
still enforced server-side (the client never decides), consistent with 0010.

## Both paths return raw ingredient lines; the client parses them

Unlike photo import (where Claude returns already-parsed ingredient fields),
URL import returns `ingredient_lines: string[]` — verbatim lines from JSON-LD or
from Claude. The client runs them through the **same Slice 2 engine parser +
Slice 3 matcher** used by paste-to-parse (`parseIngredientBlock`), so quantities,
units, and canonical matches are produced by one code path we already trust and
test, and low-confidence/unmatched rows get the same review badges. A shared
`buildDetail` helper assembles the `RecipeDetail` for both photo and URL imports.

## No CI e2e for the live fetch/parse

Same reasoning as 0010: the fallback calls Claude (costs money, non-deterministic,
needs a key CI lacks), and the fetch depends on live third-party sites. Both
paths were verified manually against a local JSON-LD page (free path) and a
plain-HTML page (Claude fallback, one credit). The review → save half is covered
by the existing Slice 4 recipe e2e. `parse-recipe-url` must be deployed
(`supabase functions deploy parse-recipe-url`) with `ANTHROPIC_API_KEY` set for
the fallback to work in production.
