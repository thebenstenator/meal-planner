import type { PlanEntry } from '@/features/planner/api';
import { PLAN_KIND_LABELS, type Slot } from '@/schemas/plan';

/** Map/group key for a day + slot. */
export function keyOf(date: string, slot: Slot): string {
  return `${date}|${slot}`;
}

/** Display label for a plan entry across all kinds. */
export function entryLabel(entry: PlanEntry): string {
  switch (entry.kind) {
    case 'recipe':
      return entry.recipeTitle ?? 'Recipe';
    case 'note':
      return entry.note ?? 'Note';
    default:
      return PLAN_KIND_LABELS[entry.kind];
  }
}

/** Callbacks the week view needs from the planner page. */
export interface PlannerActions {
  addTarget: { date: string; slot: Slot } | null;
  movingId: string | null;
  openAdd: (date: string, slot: Slot) => void;
  closeAdd: () => void;
  startMove: (id: string) => void;
  moveHere: (date: string, slot: Slot) => void;
  remove: (id: string) => void;
}
