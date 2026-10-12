# 0017 — Month forecast & "where the money went" summary

Status: accepted · Date: 2026-10-12 · Builds on: 0012, 0016

Closes the V2 roadmap's done-when: a household can answer "did we stay on
budget, and where did the money go?" without a spreadsheet. Two pieces: a
forecast while the month is still running, and a per-month breakdown after.

## Forecast: three non-overlapping parts

    projected = spent + still to buy + upcoming meals no list covers yet

- **Spent** — the 0016 ledger (trips + open checked items).
- **Still to buy** — unchecked items on lists shopping for the rest of the
  month: dated lists overlapping [today, month end], plus undated running/store
  lists (current month only — they have no dates to place them elsewhere).
  Purchase-based, like the list's own projected total.
- **Unlisted meals** — recipe meals from today on whose date falls outside every
  dated list's range, at consumption cost.

The naive forecast — spent + planned meal cost for the rest of the month —
double-counts the common case of shopping ahead: Monday's trip for the week is
already spent, and Tuesday–Sunday's meals would be counted again. So a meal
inside any list's date range is treated as shopped-for: its groceries are
either bought (in spent) or still on the list (in to-buy). That's the property
the e2e asserts — one meal's $2.50 moves from to-buy to spent and the projection
doesn't change.

Coverage is by **date range**, not item provenance: provenance rows are deleted
with their items on clear, which would make a bought meal look unlisted again.
Known gaps, accepted: a meal added inside a list's range after generating isn't
costed until the list is regenerated; deleting a list un-covers its meals; a
list spanning into next month counts all its unchecked items now.

A past month projects exactly what was spent. When nothing more is coming
(projected = spent) the forecast line is hidden rather than repeat the spend.
Shown on the planner's budget bar and the current month's summary.

## Summary: totals reconcile with the ledger

`summarizeMonth` splits each trip's total across its line items' categories —
the category a list item would get (household override → ingredient's own →
name guess), so the breakdown matches the aisles on the list. Whatever a trip's
priced lines don't explain (tax, a typed total with no item prices) is **Not
itemized**, always listed last; lines adding up to more than the total (coupons,
a mis-scan) are scaled down to it. Open checked items add under their list
category. The category rows therefore always sum to the month's spend.

The card also shows budget variance, change vs the previous month, the five
priciest planned recipes (grouped, consumption cost), and how much of the total
is estimated (estimated trips + unrecorded open items) with a nudge to log real
totals. It opens for whichever month is tapped on the spending page's chart or
table; the current month by default.

No migration: everything derives from existing tables.
