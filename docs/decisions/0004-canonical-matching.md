# 0004 — Canonical ingredients & matching (Slice 3)

Status: accepted · Date: 2026-08-01

## Matching lives in Postgres, not TypeScript

The ordered strategy (exact → alias → household-learned → trigram) is a
`match_canonical_ingredient` SQL function. Trigram similarity is a `pg_trgm`
feature, and doing exact/alias/learned in the same function keeps the whole
decision in one round trip against indexed data. The client calls it via RPC and
never reimplements ranking. The engine (Slice 2) stays pure and consumes the
already-resolved `canonicalId` + `CanonicalInfo`.

## Threshold + runner-up gap, not just a threshold

A trigram match is accepted only if the best score ≥ 0.45 **and** it clearly
beats the runner-up (gap ≥ 0.05, or the best is very strong ≥ 0.7, or there is no
runner-up). This encodes specs/05's "take the best match only if it clearly beats
the runner-up" and keeps genuinely ambiguous inputs (e.g. two similar canonicals)
in the unresolved path instead of silently picking one.

## LLM disambiguation deferred

specs/05 step 5 (send the top candidates to an LLM) needs the Edge Function that
arrives in Slice 9. Until then, an ambiguous or below-threshold input returns no
match, and the UI will let the user pick/create — which also feeds the
household-learned map so it self-corrects.

## Global rows are read-only to clients

`canonical_ingredient` holds shared seed rows (`household_id null`) and per-
household rows. RLS lets any authenticated user read globals and their own rows,
but only lets them insert/update household rows. Editing a global row would mean
forking a per-household override; that's deferred. The seed is reference data and
ships via migration so staging/prod get it too (not `seed.sql`, which is dev-only).

## Merge is soft

Deduping sets `merged_into_id` rather than deleting, so provenance and any
existing references survive. `resolve_canonical` follows the chain (bounded to 10
hops) when matching, so a learned mapping to a since-merged row still resolves to
the survivor.

## Seed size

172 rows now — a real starter covering common groceries, the demo, and the
conversion facts the engine needs (densities, count_to_gram, package sizes).
specs/03 calls for ~500; the table and matcher don't care about the count, so the
list grows over time. Adding rows is a data-only migration.
