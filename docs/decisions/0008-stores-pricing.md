# 0008 — Stores & pricing (Slice 7)

Status: accepted · Date: 2026-08-04

## price_record is append-only

Prices are user-owned truth and change over time. Rather than mutating a price,
every observation is a new `price_record` row (RLS grants insert + select, no
update/delete). This gives price history for free (V3 trends), makes "how stale
is this?" answerable, and the current price is simply the most recent row per
(canonical, store) via `get_current_prices`.

## Capture package price + size, not unit price

Users know "$2.50 for an 8 oz block", not "$0.31/oz". We store `price_cents` for
`package_quantity` of `package_unit` and derive the rest. The unit price is never
stored — it's computed when needed.

## Cost is charged on the purchased quantity

`estimateItemCost` converts the needed quantity into the package's unit (via the
engine, using density/count facts when units differ), then rounds **up to whole
packages** and multiplies by the package price. You can't buy 1.5 blocks of cream
cheese, so the honest projected total prices what you actually put in the cart —
matching the engine's purchase rounding (specs/05).

## Pricing is computed at display time, not persisted

The list's projected total and per-item costs are derived in a hook from the
current prices + conversion facts, not written onto `shopping_list_item`. Prices
change independently of the list, so recomputing on render keeps the total honest
without a reprice-on-every-price-change job. (`estimated_price_cents` remains on
the table for a future denormalization if needed.)

## Pricing uses the household's default store

A list prices against the default store. Per-list store selection exists in the
schema (`shopping_list.store_id`) but the UI defaults to one store for now;
multi-store comparison is a V3 concern.

## Staleness is a threshold, surfaced not enforced

`price_stale_days` (default 30, configurable) flags old prices on the list and in
the store's price review, with a one-tap "update price" that appends a fresh
record. Nothing is auto-hidden or blocked — the shopper decides.
