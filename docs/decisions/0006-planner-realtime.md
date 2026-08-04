# 0006 — Planner & realtime (Slice 5)

Status: accepted · Date: 2026-08-04

## REPLICA IDENTITY FULL for filtered deletes

`plan_entry` is published to `supabase_realtime` and the client subscribes with a
`household_id=eq.<id>` filter. By default Postgres logical replication sends only
the primary key for DELETEs, so the `old` row has no `household_id` and the
filtered subscription never matches a delete — a partner would see adds live but
not removals. Setting `REPLICA IDENTITY FULL` makes DELETE events carry every
column, so the filter matches. (Confirmed by e2e: without it the remove-sync
assertion failed; with it, add and remove both sync in ~5s.)

## Realtime auth is set from the session

For RLS-filtered `postgres_changes`, the socket must present the user's token.
`AuthProvider` calls `supabase.realtime.setAuth(session.access_token)` on load and
on every auth change, so channels are authorized and each client only receives
changes for rows it can see.

## Realtime invalidates queries; it isn't a second source of truth

The subscription doesn't patch the cache directly — on any change it invalidates
`['plan', householdId]` and TanStack Query refetches. Simpler and race-free: the
database stays the single source of truth, and one code path renders the plan.

## Month = overview, Week = editing

A full 7×N month grid with four editable slots per cell is unusable at 375px. The
month grid is a compact read-only overview; tapping a day switches to the week
view, where each day has room for slots, add/move/remove, and the inline
add-entry flow. Both read the same `plan_entry` data over the visible range.

## Tap-to-move instead of drag

specs/07 mentions drag on desktop. Native drag-and-drop is fiddly on touch and
adds a dependency; tap-to-move (select an entry, then tap "Move here" on a slot)
works identically on phone and desktop and is straightforward to test. Drag can
be layered on later without changing the data model.

## Kinds carry through to consolidation

`leftovers` and `eating_out` entries are stored but contribute nothing to the
shopping list — that exclusion is enforced in Slice 6. Tracking them is the whole
point (they explain the gaps in a month of dinners).
