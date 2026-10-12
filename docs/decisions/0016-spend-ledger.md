# 0016 — Spend ledger: trips are the record, checked items are provisional

Status: accepted · Date: 2026-10-12 · Amends: 0012 ("Planned vs. actual")

## Problem

Actual spend was the sum of two overlapping sources — logged `grocery_trip`
totals **plus** the cost of every checked-off list item — and the second source
was fragile:

- **Double counting.** Logging a trip (Finish trip) left the bought items checked
  until the shopper chose to clear them. Closing the dialog with "Keep them"
  counted the same groceries twice: once as the trip total, once as item
  estimates.
- **Spend vanished.** Clearing checked items (or deleting the list) deleted the
  only record of them, so a month's spend dropped after the fact.
- **Inconsistent months.** The planner's budget bar counted a list in every month
  its date range overlapped (a list spanning Oct 28–Nov 10 counted in full in
  both); the spending page counted it only in its start month.
- **Running and store lists never counted.** They have no date range, so their
  checked items were excluded from spend entirely.
- **Regeneration dropped paid prices.** It carried `is_checked` across but lost
  `actual_cost_cents`, and deleted checked items the new plan no longer needed.

## Decision

**`grocery_trip` is the ledger.** A checked item counts as spend only while no
trip accounts for it ("open"), and every way an item leaves the list turns it
into a trip first. Actual spend for a period is therefore

    Σ trips by purchased_on  +  Σ open checked items by checked_at

and the two terms never overlap. One pure function (`rollupSpend`) and one hook
(`useSpendInRange`) compute it for both the budget bar and the spending page.

- `shopping_list_item.trip_id` links an item to the trip that paid for it. Finish
  trip links every checked item, plus the "missed" items a receipt reconciles.
  Deleting a trip un-links (`on delete set null`), so its items count again.
- `shopping_list_item.checked_at` is stamped by a trigger when an item is checked
  (cleared when unchecked; backfilled from `updated_at`). Open items fall in the
  month they were bought — on any list, dated or not.
- **Clearing archives.** `clear_checked_items` (RPC, invoker/RLS) groups open
  checked items by local purchase day into `grocery_trip`s with
  `is_estimated = true` and line items, then deletes the checked items. Prices are
  the recorded actual price or the client's purchase estimate (unit conversion
  lives in the TS engine, so the client passes `item id → cents`). Days with no
  priced items create no trip. Deleting a list clears it first.
- **Regeneration preserves.** `generate_shopping_list` carries `checked_at`,
  `trip_id` and `actual_cost_cents` with `is_checked`, and keeps checked items
  whose need disappeared — they were bought.

This reverses one 0012-era behaviour on purpose: the bare "clear checked" used to
mean "discard this spend." It now means "I don't want to type a total"; the
estimate is kept. Unchecking is the way to say an item wasn't bought.

## Consequences

- Price drift is bounded: only open items are priced at *current* prices, and
  they freeze into a trip as soon as the list is cleared.
- Estimated trips show "estimated from list" in the trip log and can be deleted
  there like any trip.
- Known gap: a receipt scanned from the standalone Receipts page isn't linked to
  any list, so items still checked on a list would count alongside it. Finish
  trip is the linked path; the standalone page is for receipts with no list.
