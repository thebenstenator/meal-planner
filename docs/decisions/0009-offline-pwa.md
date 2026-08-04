# 0009 — Offline & PWA (Slice 8)

Status: accepted · Date: 2026-08-04

## TanStack Query persistence instead of a Dexie mirror

specs/02 and specs/07 name Dexie for the offline store with a hand-rolled
mutation queue. The whole app already routes 100% of server state through
TanStack Query, which ships first-class offline support: cache persistence and
automatic pause/replay of mutations. So instead of maintaining a parallel Dexie
mirror + a custom queue (a lot of stateful, bug-prone code and a second source of
truth to keep consistent), we:

- persist the query cache to `localStorage` via `PersistQueryClientProvider`
  (readable offline, survives reload), and
- rely on Query's default `networkMode: 'online'` to **queue** mutations while
  offline and replay them on reconnect (`resumePausedMutations` on cache
  restore; automatic on the reconnect event).

This delivers the same demo — airplane mode, check off items, sync on reconnect —
with far less code and no consistency layer to debug. Dexie can be layered in
later if a feature needs large offline datasets or richer conflict resolution;
nothing here blocks that.

## Optimistic check-off is applied synchronously

The check-off optimistic update runs before any `await` in `onMutate`, so a
controlled checkbox never briefly reverts (which also tripped a strict Playwright
`check()`). The mutation itself pauses when offline; the optimistic state holds
until it replays.

## Conflict resolution: last-write-wins at the row level

Our offline mutations are small field updates (e.g. `is_checked`). When they
replay, the last write to reach Postgres wins — effectively last-write-wins,
which is fine for V1. The database stays the single source of truth; on reconnect
`onSettled` invalidates and refetches, so the server value reconciles the UI.
Field-level merge/CRDTs are out of scope for V1.

## Persisted cache is cleared on sign-out

The `localStorage` cache is wiped on `SIGNED_OUT` so no household data lingers on
a shared device. RLS + household-scoped query keys already prevent cross-account
reads, but clearing is defense in depth.

## Icons are SVG

The manifest points at the existing `favicon.svg` (`purpose: any maskable`),
which satisfies Chromium installability without a PNG asset-generation step. PNG
icons can be added later with `@vite-pwa/assets-generator` if store submission
needs them.
