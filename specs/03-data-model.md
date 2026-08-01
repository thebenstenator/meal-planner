# 03 — Data Model

PostgreSQL. Every user-owned table carries `household_id` and is protected by a
Row Level Security policy. All tables have `id uuid primary key default gen_random_uuid()`,
`created_at timestamptz default now()`, `updated_at timestamptz default now()`.

## Entity relationship (conceptual)

```
household ──< household_member >── user
    │
    ├──< recipe ──< recipe_ingredient >── canonical_ingredient
    │                                          │
    ├──< store ──< price_record >──────────────┤
    │                                          │
    ├──< plan_entry >── recipe                 │
    │                                          │
    ├──< shopping_list ──< shopping_list_item >┤
    │                                          │
    ├──< pantry_item >─────────────────────────┤
    │                                          │
    ├──< grocery_trip ──< trip_line_item >─────┤
    │                                          │
    └──< waste_log >───────────────────────────┘
```

---

## Core tables

### `household`
The tenancy boundary. Everything belongs to a household, not a user.

| column | type | notes |
|---|---|---|
| name | text | "The Smiths" |
| monthly_budget_cents | integer | nullable; used for planned-vs-actual |
| default_store_id | uuid | FK → store, nullable |

### `household_member`
| column | type | notes |
|---|---|---|
| household_id | uuid | FK |
| user_id | uuid | FK → auth.users |
| role | text | `owner` \| `member` |
| invited_at / joined_at | timestamptz | |

A user may belong to multiple households (rare, but don't design it out).

### `household_invite`
| column | type | notes |
|---|---|---|
| household_id | uuid | FK |
| code | text | short, unique, human-typeable |
| expires_at | timestamptz | |
| accepted_by | uuid | nullable |

---

## Recipes

### `recipe`
| column | type | notes |
|---|---|---|
| household_id | uuid | FK |
| title | text | |
| description | text | nullable |
| meal_types | text[] | `main` \| `side` \| `dessert` \| `snack` \| `breakfast` \| `drink` |
| servings | integer | base yield; drives scaling |
| prep_minutes / cook_minutes | integer | nullable |
| instructions | text | markdown |
| source | text | nullable — "Grandma's binder p. 4" |
| image_path | text | nullable — Supabase Storage key |
| tags | text[] | dietary + freeform: `vegetarian`, `gluten-free`, `kid-approved` |
| notes | text | nullable — household's running notes |
| rating | smallint | nullable, 1–5 |
| times_cooked | integer | default 0, incremented from plan entries |
| last_cooked_on | date | nullable |
| import_status | text | `manual` \| `ocr_pending` \| `ocr_review` \| `confirmed` |

### `recipe_ingredient`
One row per ingredient line as written in the recipe.

| column | type | notes |
|---|---|---|
| recipe_id | uuid | FK, cascade delete |
| position | integer | display order |
| raw_text | text | **always keep the original line verbatim** |
| quantity | numeric | nullable — null for "to taste" |
| unit | text | nullable — normalized enum, see engine doc |
| canonical_ingredient_id | uuid | FK, nullable until matched |
| descriptor | text | nullable — "softened", "finely diced" |
| is_optional | boolean | default false |
| parse_confidence | numeric | 0–1, from the parser |
| needs_review | boolean | true when the parser wasn't confident |

`raw_text` is sacred. Never overwrite it with a reconstructed string — it's the
audit trail when parsing goes wrong.

### `canonical_ingredient`
The deduplication key. Household-scoped, seeded from a global starter list.

| column | type | notes |
|---|---|---|
| household_id | uuid | FK, nullable → null means global/seed row |
| name | text | "cream cheese" |
| aliases | text[] | "philadelphia", "neufchatel" |
| category | text | aisle grouping: `produce`, `dairy`, `meat`, `pantry`, ... |
| default_unit | text | preferred purchase unit |
| density_g_per_ml | numeric | nullable — enables volume↔weight conversion |
| unit_size | numeric + text | typical package size, e.g. 8 / `oz` |
| merged_into_id | uuid | FK self, nullable — soft-merge target |

Index: `gin (name gin_trgm_ops)` and `gin (aliases)` for fuzzy matching.

---

## Planning

### `plan_entry`
| column | type | notes |
|---|---|---|
| household_id | uuid | FK |
| date | date | |
| slot | text | `breakfast` \| `lunch` \| `dinner` \| `snack` |
| kind | text | `recipe` \| `leftovers` \| `eating_out` \| `note` |
| recipe_id | uuid | FK, nullable — required when kind = `recipe` |
| servings_override | integer | nullable — drives recipe scaling |
| leftovers_from_entry_id | uuid | FK self, nullable |
| note | text | nullable |
| position | integer | ordering within a slot (mains + sides on one plate) |

`kind = leftovers` and `eating_out` entries contribute **zero** to the shopping list.
That's the whole point of tracking them.

---

## Pricing

### `store`
| column | type | notes |
|---|---|---|
| household_id | uuid | FK |
| name | text | "Walmart — Eagle Mountain" |
| is_default | boolean | |

### `price_record`
Append-only. Never update a price — insert a new record. This gives price history
for free (V3 trends) and makes "how stale is this price?" answerable.

| column | type | notes |
|---|---|---|
| household_id | uuid | FK |
| canonical_ingredient_id | uuid | FK |
| store_id | uuid | FK |
| price_cents | integer | package price |
| package_quantity | numeric | e.g. 8 |
| package_unit | text | e.g. `oz` |
| source | text | `manual` \| `receipt_ocr` \| `estimated` |
| observed_on | date | |

Derived: `unit_price_cents = price_cents / package_quantity`. Compute in a view,
don't store it.

Current price for an ingredient = most recent `observed_on` for that store.

---

## Shopping

### `shopping_list`
| column | type | notes |
|---|---|---|
| household_id | uuid | FK |
| name | text | "Week of Mar 3" |
| date_range_start / _end | date | the plan window it was generated from |
| store_id | uuid | FK, nullable |
| status | text | `draft` \| `active` \| `completed` |
| generated_at | timestamptz | |

### `shopping_list_item`
The consolidated output. **This is the money table.**

| column | type | notes |
|---|---|---|
| shopping_list_id | uuid | FK |
| canonical_ingredient_id | uuid | FK, nullable for ad-hoc items |
| ad_hoc_name | text | nullable — "paper towels" |
| total_quantity | numeric | summed + converted |
| unit | text | |
| category | text | denormalized from canonical, for aisle grouping |
| estimated_price_cents | integer | nullable |
| price_is_stale | boolean | derived flag for UI |
| pantry_offset_quantity | numeric | how much was subtracted from pantry (V2) |
| is_checked | boolean | shopper checks off in the store |
| actual_price_cents | integer | nullable — filled from receipt (V2) |
| unresolved | boolean | true when consolidation couldn't merge cleanly |

### `shopping_list_item_source`
Provenance — which recipes contributed to this line item. Needed for the
"why is 12 oz of cream cheese on my list?" tap-to-expand UI.

| column | type | notes |
|---|---|---|
| shopping_list_item_id | uuid | FK |
| recipe_ingredient_id | uuid | FK |
| plan_entry_id | uuid | FK |
| contributed_quantity | numeric | in the item's unit |

---

## V2+ tables

### `pantry_item`
| column | type | notes |
|---|---|---|
| household_id | uuid | FK |
| canonical_ingredient_id | uuid | FK |
| quantity | numeric | |
| unit | text | |
| location | text | `pantry` \| `fridge` \| `freezer` |
| expires_on | date | nullable |

### `grocery_trip`
| column | type | notes |
|---|---|---|
| household_id | uuid | FK |
| store_id | uuid | FK |
| shopping_list_id | uuid | FK, nullable |
| trip_date | date | |
| total_cents | integer | |
| receipt_image_path | text | nullable |

### `trip_line_item`
Parsed receipt lines. Feeds `price_record` inserts.

### `waste_log`
| column | type | notes |
|---|---|---|
| household_id | uuid | FK |
| canonical_ingredient_id | uuid | FK |
| quantity / unit | numeric / text | |
| estimated_cost_cents | integer | derived at log time |
| reason | text | `spoiled` \| `expired` \| `leftover_uneaten` \| `overbought` |
| logged_on | date | |

---

## Row Level Security pattern

Every table gets the same shape of policy:

```sql
create policy "household members only"
on <table> for all
using (
  household_id in (
    select household_id from household_member
    where user_id = auth.uid()
  )
);
```

Write this as a helper and apply it uniformly. Do not hand-roll variations.
