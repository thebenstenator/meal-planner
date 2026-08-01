# 05 — Ingredient Engine (Parsing, Matching, Consolidation)

This is the core subsystem. Build it as a **standalone, pure, heavily-tested module**
(`src/lib/ingredients/`) with no React and no database imports. Everything else
in the app calls into it.

If this module is good, the product works. If it's mediocre, the product is
just another meal planner.

---

## Pipeline

```
raw text line
   ↓  [1] PARSE      → { quantity, unit, name, descriptor, optional }
   ↓  [2] NORMALIZE  → canonical unit enum, cleaned name
   ↓  [3] MATCH      → canonical_ingredient_id  (or: needs review)
   ↓  [4] CONVERT    → common unit per ingredient
   ↓  [5] CONSOLIDATE→ summed shopping list item
   ↓  [6] ROUND      → purchasable quantity
```

---

## [1] Parse

Input examples that must work:

```
2 cups all-purpose flour
1 (8 oz) package cream cheese, softened
1/2 tsp kosher salt
3 large eggs
2-3 cloves garlic, minced
salt and pepper to taste
1 lb boneless skinless chicken breasts (about 3)
¼ cup + 2 tbsp olive oil
```

**Strategy: two-tier.**

- **Tier 1 — deterministic parser.** A hand-written tokenizer handles the ~85% of
  lines that follow the standard `[qty] [unit] [name][, descriptor]` shape. Fast,
  free, testable, offline. Handles: unicode fractions (½ ¼ ⅓ ¾), mixed numbers
  ("1 1/2"), ranges ("2-3" → take the upper bound), parenthetical package sizes,
  "a"/"an" as quantity 1.
- **Tier 2 — LLM fallback.** Lines the deterministic parser flags as low-confidence
  go to Claude in a batch, with a strict JSON schema. Batch them — one call for
  all uncertain lines in a recipe, not one call per line.

Lines that resolve to no quantity ("salt and pepper to taste") are stored with
`quantity = null` and are **excluded from consolidation math** but still shown on
the list as a no-quantity reminder line.

### Parser output contract

```ts
type ParsedIngredient = {
  raw: string;
  quantity: number | null;
  unit: Unit | null;
  name: string;            // "cream cheese"
  descriptor: string | null; // "softened"
  isOptional: boolean;
  confidence: number;      // 0-1
};
```

## [2] Normalize

Fixed unit enum. Everything maps into it.

```ts
type Unit =
  // mass
  | 'g' | 'kg' | 'oz' | 'lb'
  // volume
  | 'ml' | 'l' | 'tsp' | 'tbsp' | 'floz' | 'cup' | 'pt' | 'qt' | 'gal'
  // count
  | 'each' | 'clove' | 'slice' | 'can' | 'package' | 'bunch' | 'head' | 'stick'
  // vague (never summed)
  | 'pinch' | 'dash' | 'to_taste';
```

Alias table maps `tablespoon`, `tbsp.`, `T`, `Tbs` → `tbsp`, etc. Build this
table exhaustively; it's cheap and prevents a whole class of bugs.

Name cleaning: lowercase, strip leading articles, strip trailing prep descriptors
into `descriptor` ("finely chopped", "softened", "divided", "at room temperature"),
strip brand names into aliases.

## [3] Match to canonical ingredient

Ordered strategy — first hit wins:

1. **Exact match** on `canonical_ingredient.name`
2. **Alias match** on `canonical_ingredient.aliases`
3. **Household-learned mapping** — if this household previously mapped this exact
   raw name, reuse it. (Store these; they compound in value.)
4. **Trigram similarity** via `pg_trgm`, threshold ~0.45. Take the best match only
   if it clearly beats the runner-up.
5. **LLM disambiguation** — send the name plus the top 5 trigram candidates, ask
   which (if any) is the same ingredient.
6. **No match** → create a household-scoped canonical ingredient, flag
   `needs_review = true`.

**Critical rule:** every automatic match above confidence threshold is still
reversible in the UI. Users will hit cases like "coconut milk" (canned) vs
"coconut milk" (carton beverage) that no algorithm resolves.

Seed a global canonical ingredient list (~500 common groceries with categories,
default units, and densities) so new households aren't starting from zero.

## [4] Convert

Three cases:

**Case A — same dimension.** Mass↔mass, volume↔volume. Pure math, always safe.
`8 oz + 4 oz = 12 oz`. `1 cup + 2 tbsp = 1.125 cup`.

**Case B — volume↔mass.** Requires `density_g_per_ml` on the canonical ingredient.
Flour ≈ 0.53, granulated sugar ≈ 0.85, water/milk ≈ 1.0, honey ≈ 1.42.
Seed densities for the common baking staples where this matters most.
**If density is unknown, do not guess.** Keep the two quantities as separate
sub-lines under one list item and flag `unresolved = true`.

**Case C — count↔anything.** "3 eggs" + "1 cup eggs" is not convertible without
per-ingredient knowledge (1 large egg ≈ 50 g). Store optional
`count_to_gram` on canonical ingredients where it's known and commonly needed
(eggs, garlic cloves, lemons, onions, sticks of butter). Otherwise: unresolved.

**The unresolved path is a feature, not a failure.** The UI shows:

> **Cream cheese** — 12 oz + 1 cup
> *Couldn't combine these automatically.* [Set a conversion] [Keep separate]

When the user sets a conversion, save it to the canonical ingredient so it
never asks again. The system gets smarter with use.

## [5] Consolidate

```
for each plan_entry in date range where kind = 'recipe':
    scale = servings_override / recipe.servings  (default 1)
    for each recipe_ingredient:
        skip if quantity is null → collect as no-qty reminder
        scaled_qty = quantity * scale
        group by canonical_ingredient_id
```

Within a group: pick the **target unit** = the canonical ingredient's
`default_unit` if all members convert to it, otherwise the unit of the
largest-quantity member. Convert and sum. Record every contribution in
`shopping_list_item_source` for the provenance UI.

## [6] Round to purchasable

A list saying "1.375 lb ground beef" is technically correct and practically useless.

Round **up** to the nearest sensible purchase increment based on the canonical
ingredient's `unit_size`:

- Needs 12 oz cream cheese, sold in 8 oz blocks → **buy 2 blocks (16 oz)**
- Needs 1.375 lb ground beef → **buy 1.5 lb**
- Needs 3.2 eggs → **buy 4 eggs** (but show "1 dozen" if that's the package)

Show both: `Buy: 2 × 8 oz package` with a secondary line `recipes need 12 oz`.
The surplus is real information — it feeds pantry tracking in V2 and explains
why the cost estimate is what it is.

**Cost is calculated on the purchased quantity, not the needed quantity.**
This is what makes the budget number honest.

---

## Testing requirements

This module needs a genuinely large fixture suite. Target: **200+ real ingredient
lines** pulled from actual cookbooks and recipe sites, with expected parse output
committed as snapshots.

Required test categories:
- Every unicode fraction and mixed number form
- Ranges, parentheticals, "about" qualifiers
- Same-dimension merges across all unit pairs
- Volume↔mass merges with and without density
- Count merges with and without count_to_gram
- Unresolved cases that must NOT silently merge
- Scaling with fractional multipliers
- Rounding to package sizes, including when unit_size is unknown

**Rule: no consolidation bug ships without a regression test added first.**
This is the module where correctness compounds — every fix should be permanent.
