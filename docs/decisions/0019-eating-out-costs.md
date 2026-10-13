# 0019 — Eating-out costs share the grocery budget

Status: accepted · Date: 2026-10-13 · Builds on: 0016, 0017

An eating-out plan entry can now have a cost (`plan_entry.cost_cents`). A check
constraint limits it to eating-out entries. The cost counts against the **same
monthly budget as groceries**. We chose that over a separate dining budget
because it's one number to set and one bar to watch. In the monthly summary,
eating out still shows as its own **"Eating out"** row, so it never blurs into
grocery categories.

## Spent vs forecast is decided by the entry's date

- **On or before today:** spent. It's added to the month in the spend rollup
  (`rollupSpend`'s `dining`), so the planner bar, the spending page, the monthly
  summary and the pre-trip check all include it. Today's meal out counts as
  spent: by the time you look at the budget, it's committed.
- **After today:** forecast. A fourth part, "+ $X eating out", sits beside
  spent, still on lists, and unlisted meals (`upcomingDiningCents`).

There's no "did you actually go?" step. Like a checked-off item, the plan entry
is the record. If plans change, you edit the cost, clear it, or remove the
entry. Making it a separate confirm step would add exactly the friction the
budget features have avoided (see 0012's "never a required step").

Dining costs are fetched by date range (`fetchDiningInRange`) under the plan's
query key, so any plan edit, including a partner's via realtime, refreshes spend
and forecast. The amount is typed in when adding an eating-out entry, or set,
changed or cleared from the entry's menu on the planner.

## Related fix: pages wait for the household

This feature's e2e test, which adds a store straight after sign-up, failed
every time with an RLS rejection. Pages render as soon as there's a session,
and the household query may still be loading at that point, especially on a
cold start or a slow network. Any write fired then went out with
`household_id = null`. Eighteen mutations pass `householdId as string`.
Rather than guard each one, the signed-in layout now holds the page (header
and nav stay) until the household is known (`useHousehold().isResolving`).
The household is in the persisted cache, so this only shows on a cold start.
It's skipped while the query is offline-paused, so the app still opens
offline.
