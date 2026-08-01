# Project Docs — Meal Planner & Grocery Budget App

**Working name:** TBD (placeholder: `mealplan`)

This folder is the planning bundle for the project. It is written to be read by an AI
coding agent (Claude Code) working inside VS Code, as well as by a human.

## Read order

| File | Purpose |
|---|---|
| `01-overview.md` | What this is, who it's for, why it's different |
| `02-tech-stack.md` | Every technology choice + why |
| `03-data-model.md` | Entities, relationships, schema |
| `04-features.md` | Full feature catalog (all tiers) |
| `05-ingredient-engine.md` | Spec for the hardest/most important subsystem |
| `06-roadmap.md` | V1 (MVP) → V2 → V3 → backlog |
| `07-vertical-slices.md` | **Build instructions — one shippable slice at a time** |
| `08-monetization.md` | Free vs premium, pricing model options |
| `09-risks.md` | Roadblocks, constraints, known hard problems |
| `10-conventions.md` | Code style, folder structure, testing, definition of done |

## How the agent should use this

1. Read `01`, `02`, `03`, and `10` before writing any code.
2. Work through `07-vertical-slices.md` **in order**. Do not skip ahead.
3. Each slice is end-to-end (database → API → UI → test) and must be
   demoable before the next slice starts.
4. If a decision isn't specified here, prefer the simplest thing that
   doesn't block a later slice, and record the decision in `/docs/decisions/`.

## Non-negotiables

- **Ingredient consolidation is the product.** Everything else is table stakes.
  If it doesn't merge "8 oz cream cheese" and "4 oz cream cheese" into one
  12 oz line item, the app has no reason to exist.
- **Offline-first.** People use this standing in a grocery aisle with bad signal.
- **Shared by household.** Two people editing the same plan is the normal case,
  not an edge case.
- **Never lose a user's recipes.** Recipes are irreplaceable family data.
