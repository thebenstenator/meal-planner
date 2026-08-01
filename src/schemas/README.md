# `src/schemas` — shared Zod schemas

Single source of truth for anything that crosses a boundary: API responses, AI
model output, and form input (see `10-conventions.md`).

**These schemas are shared with Supabase Edge Functions** (`supabase/functions/*`).
Keep them free of browser- and React-only imports so Deno can import them too.
Infer TypeScript types _from_ Zod (`z.infer`), never the reverse.
