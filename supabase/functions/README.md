# Supabase Edge Functions (Deno)

These exist for one reason: **the Anthropic API key must never reach the client**
(see `02-tech-stack.md`). All AI parsing calls are proxied here.

Planned functions (arrive with their slices):

- `parse-recipe/` — Claude vision → strict JSON recipe (Slice 9)
- `parse-receipt/` — Claude vision → receipt line items (Slice 12)

Functions import shared Zod schemas from `src/schemas/`, so keep those free of
browser/React-only imports. Validate every model response with Zod before it
touches the database.
