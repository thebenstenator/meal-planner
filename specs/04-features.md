# 04 — Feature Catalog

Every feature discussed, organized by area. Version assignment lives in
`06-roadmap.md`; this file is the full inventory with behavior notes.

Legend: **[V1]** MVP · **[V2]** · **[V3]** · **[BL]** backlog

---

## 1. Recipes

| Feature | Ver | Notes |
|---|---|---|
| Manual recipe entry | V1 | Structured ingredient rows, not a text blob |
| Ingredient line autocomplete | V1 | Suggests canonical ingredients as you type |
| Recipe library with search & filter | V1 | By title, ingredient, meal type, tag |
| Meal type tagging | V1 | main / side / dessert / snack / breakfast / drink |
| **Photo capture → AI parse** | V1 | The headline import feature |
| **Multi-page photo capture** | V1 | N photos → one recipe. Beats Skylight. |
| Parse review screen | V1 | User confirms/corrects before save. Never auto-save AI output. |
| Recipe scaling | V2 | Serves 4 → serves 6, propagates to list and cost |
| Dietary tags & allergens | V2 | Filterable; warns when planning conflicts |
| Substitution notes | V2 | "sub Greek yogurt for sour cream" stored per ingredient |
| Recipe notes & ratings | V3 | "kids didn't like it", "less cayenne next time" |
| Times-cooked / last-cooked | V3 | Auto-incremented from plan entries |
| "Haven't made in a while" surface | V3 | Fights decision fatigue |
| Import from URL | BL | Parse recipe schema.org JSON-LD from recipe sites |
| Recipe sharing between households | BL | **Blocked on copyright review — see `09-risks.md`** |

## 2. Meal planner

| Feature | Ver | Notes |
|---|---|---|
| Monthly calendar view | V1 | The month is the unit, not the week |
| Weekly view | V1 | Same data, denser view for actual cooking week |
| Assign recipe to date + slot | V1 | Drag on desktop, tap-to-assign on mobile |
| Multiple items per slot | V1 | Main + side + dessert on one dinner |
| Leftovers day | V1 | Contributes nothing to the shopping list |
| Eating-out day | V1 | Same — zero list contribution |
| Free-text note entries | V1 | "Sarah's birthday", "potluck" |
| Servings override per entry | V2 | Feeds recipe scaling |
| Copy week / copy month | V2 | Huge time saver, cheap to build |
| Meal-type balance summary | V3 | "12 chicken nights, 2 vegetarian" — variety awareness |
| **Auto-fill a balanced month** | V3 | **Premium flagship.** One-tap fill an empty/partial month mixing favorites, "haven't made in a while", and fresh AI ideas; balanced for variety, honors dietary tags, biased to use up pantry. Editable proposal, never auto-committed; regenerate any day. Composes suggest-meals + planner + consolidation. See `08-monetization.md`. |
| Plan templates | BL | Save a favorite week as a reusable template |

## 3. Shopping list

| Feature | Ver | Notes |
|---|---|---|
| **Generate from date range** | V1 | Any window, not just calendar weeks |
| **Ingredient consolidation** | V1 | The core differentiator. See `05-ingredient-engine.md`. |
| Unit conversion during merge | V1 | oz+oz trivially; cups→oz needs density data |
| Unresolved-merge review | V1 | Never silently guess. Surface for a two-tap fix. |
| Provenance ("why is this here?") | V1 | Expand a line to see contributing recipes |
| Aisle/category grouping | V1 | Produce, dairy, meat, pantry... |
| Check off items while shopping | V1 | Offline-capable, syncs when signal returns |
| Ad-hoc items | V1 | "paper towels" — not from any recipe |
| Manual quantity override | V1 | User is always allowed to overrule the math |
| Subtract pantry stock | V2 | List shows what you actually need to buy |
| Export / print | V2 | Some people want paper at the store |
| Share as text | V2 | Paste into a message to a partner |
| Split list by store | V3 | "produce at Costco, rest at Walmart" |
| Grocery-delivery-friendly copy | BL | Formatted for pasting into Instacart/Walmart |

## 4. Pricing & budget

| Feature | Ver | Notes |
|---|---|---|
| Manual price entry per item | V1 | Price is user-owned truth |
| Multiple stores | V1 | Prices are per store |
| Price staleness indicator | V1 | "Updated 6 weeks ago — still right?" |
| Projected monthly cost | V1 | The number the user actually came for |
| Cost per recipe | V2 | Rank recipes cheapest → most expensive |
| Cost per serving | V2 | Derived, secondary to per-item |
| **Planned vs. actual spend** | V2 | Set a budget, track variance |
| **Receipt photo → price update** | V2 | Sidesteps the missing store API entirely |
| Grocery trip log | V2 | Date, store, total — doubles as actual-spend source |
| End-of-month summary | V2 | Total spent, variance, priciest meals, waste $ |
| Price history / trend per item | V3 | "chicken went $3.99 → $4.49 over 3 months" |
| Month-over-month spend trend | V3 | Needs several months of data to be useful |
| Store price comparison | V3 | Same item, two stores, side by side |
| Marginal cost of a meal | V3 | Cost using pantry stock vs. buying everything |

## 5. Pantry & waste

| Feature | Ver | Notes |
|---|---|---|
| Pantry / fridge / freezer inventory | V2 | Manual add, decrement on cook |
| Auto-add purchased items to pantry | V2 | From a completed shopping trip |
| Expiration tracking | V3 | With optional reminders |
| Waste log with cost | V3 | "$34 thrown out this month" is motivating; "some spinach" isn't |
| Leftover utilization rate | V3 | Are leftover nights actually happening? |
| "Use it up" suggestions | BL | Recipes matching soon-to-expire pantry items |

## 6. Household & sync

| Feature | Ver | Notes |
|---|---|---|
| Auth (email + OAuth) | V1 | |
| Household creation | V1 | |
| Invite member by code/link | V1 | |
| Realtime shared editing | V1 | Two people, same plan, same list |
| Offline-first operation | V1 | Grocery stores have bad signal. Non-negotiable. |
| Conflict resolution | V1 | Last-write-wins per field, with a visible sync indicator |
| Per-member permissions | BL | Owner vs. member is enough for now |

## 7. Notifications

| Feature | Ver | Notes |
|---|---|---|
| Shopping day reminder | V3 | |
| Prep reminders | V3 | "Thaw the chicken tonight" |
| Price refresh nudges | V3 | Batched weekly, never nagging |
| Expiration alerts | V3 | |

## 8. Platform & distribution

| Feature | Ver | Notes |
|---|---|---|
| Installable PWA | V1 | |
| Offline shell + data | V1 | |
| iOS app (Capacitor) | V3 | |
| Android app (Capacitor) | V3 | |
| Native camera integration | V3 | Better than browser camera on iOS |

## 9. Monetization

| Feature | Ver | Notes |
|---|---|---|
| Free tier limits | V3 | See `08-monetization.md` |
| Premium entitlement check | V3 | Via RevenueCat |
| Paywall UI | V3 | |
| Web checkout (Stripe) | V3 | |
| iOS/Android in-app purchase | V3 | Required by store policy |
