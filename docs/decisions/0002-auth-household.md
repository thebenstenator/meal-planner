# 0002 — Auth & household (Slice 1)

Status: accepted · Date: 2026-08-01

## Google OAuth deferred

Slice 1's checklist lists email/password **and** Google OAuth. Google OAuth
requires a Google Cloud OAuth client (id + secret) that only the project owner
can create, and wiring it into Supabase auth config. Email/password is fully
functional locally with no external setup, and it unblocks every downstream
slice.

Decision: ship email/password now; leave Google as a config-gated stub. The
`GOOGLE_OAUTH_ENABLED` constant in `src/features/auth/context.ts` disables the
button and the `signInWithGoogle` path is already implemented. Enabling it later
is: add the Google credentials to Supabase auth config, flip the constant to
`true`. No other code changes.

## Household is created by a database trigger, not the client

`handle_new_user()` fires `after insert on auth.users` and creates the household
plus the owner `household_member` row in one server-side transaction
(SECURITY DEFINER). Doing this client-side after signup would be racy (the client
might not be authenticated yet, or could fail between the two inserts and leave a
user with no household). The trigger guarantees every user has exactly one
household the instant they exist.

## RLS membership helpers are SECURITY DEFINER to avoid recursion

`is_household_member()` / `is_household_owner()` query `household_member`
directly. If the policies **on** `household_member` called a plain function that
re-selected `household_member`, RLS would recurse. Marking the helpers
SECURITY DEFINER makes them run as the owner and bypass RLS internally, breaking
the cycle. Every user-data table from here on reuses `is_household_member(...)`
in its policy — the uniform pattern from `specs/03-data-model.md`.

## Invite create/accept and member listing go through SECURITY DEFINER RPCs

- `create_household_invite()` generates an unambiguous 8-char code (no I/L/O/0/1),
  retries on collision, and checks the caller is a member.
- `accept_household_invite()` validates the code + expiry, inserts membership for
  `auth.uid()` (idempotent via `on conflict do nothing`), and marks the invite
  accepted.
- `get_household_members()` joins `auth.users` for emails, which the client
  cannot read directly under RLS. Guarded by `is_household_member`.

Routing writes through these RPCs means the tables need only SELECT policies for
the client; all mutations are validated server-side.

## New Supabase CLI key format

The installed CLI issues `sb_publishable_…` / `sb_secret_…` keys instead of the
legacy anon/service JWTs. The app's local-dev fallback key and `.env` use the
publishable key. Staging/production supply their own via env.
