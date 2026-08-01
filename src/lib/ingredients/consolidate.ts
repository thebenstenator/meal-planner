import { convert } from '@/lib/ingredients/convert';
import { roundToPurchase } from '@/lib/ingredients/round';
import type {
  CanonicalInfo,
  ConsolidatedItem,
  ConsolidationInput,
  Contribution,
} from '@/lib/ingredients/types';
import { UNIT_META, dimensionOf, type Unit } from '@/lib/ingredients/units';

export type CanonicalInfoLookup = (canonicalId: string) => CanonicalInfo | undefined;

interface Member {
  ref?: string;
  quantity: number; // already scaled
  unit: Unit;
}

/**
 * Merge many recipe lines into consolidated shopping-list items (specs/05,
 * step 5). Lines are grouped by canonicalId, scaled, converted to a common
 * unit, and summed. When they can't be merged cleanly the item is flagged
 * `unresolved` with per-unit subtotals rather than silently guessing.
 */
export function consolidate(
  inputs: ConsolidationInput[],
  lookup: CanonicalInfoLookup = () => undefined,
): ConsolidatedItem[] {
  const order: string[] = [];
  const groups = new Map<string, ConsolidationInput[]>();

  for (const input of inputs) {
    const existing = groups.get(input.canonicalId);
    if (existing) {
      existing.push(input);
    } else {
      groups.set(input.canonicalId, [input]);
      order.push(input.canonicalId);
    }
  }

  return order.map((canonicalId) => {
    const lines = groups.get(canonicalId) ?? [];
    const info = lookup(canonicalId);
    return consolidateGroup(canonicalId, lines, info);
  });
}

function consolidateGroup(
  canonicalId: string,
  lines: ConsolidationInput[],
  info: CanonicalInfo | undefined,
): ConsolidatedItem {
  const name = info?.name ?? lines.find((l) => l.name)?.name ?? canonicalId;

  const members: Member[] = [];
  let noQuantityCount = 0;
  const contributions: Contribution[] = [];

  for (const line of lines) {
    const isQuantitative =
      line.quantity != null && line.unit != null && dimensionOf(line.unit) !== 'vague';
    if (!isQuantitative) {
      noQuantityCount += 1;
      contributions.push({
        ref: line.ref,
        quantity: line.quantity,
        unit: line.unit,
        contributedQuantity: null,
      });
      continue;
    }
    const scaled = (line.quantity as number) * (line.scale ?? 1);
    members.push({ ref: line.ref, quantity: scaled, unit: line.unit as Unit });
  }

  const base = {
    canonicalId,
    name,
    category: info?.category,
    noQuantityCount,
  };

  if (members.length === 0) {
    return {
      ...base,
      totalQuantity: null,
      unit: null,
      unresolved: false,
      subTotals: [],
      contributions,
      purchase: null,
    };
  }

  // Try the default unit first, then the largest member's unit.
  const targets: Unit[] = [];
  if (info?.defaultUnit) targets.push(info.defaultUnit);
  targets.push(largestUnit(members));

  for (const target of targets) {
    const resolved = tryResolve(members, target, info);
    if (resolved) {
      const memberContribs: Contribution[] = members.map((m, i) => ({
        ref: m.ref,
        quantity: m.quantity,
        unit: m.unit,
        contributedQuantity: resolved.converted[i] ?? null,
      }));
      const purchase = info?.unitSize
        ? roundToPurchase(resolved.total, target, info.unitSize, info)
        : null;
      return {
        ...base,
        totalQuantity: round6(resolved.total),
        unit: target,
        unresolved: false,
        subTotals: [],
        contributions: [...memberContribs, ...contributions],
        purchase,
      };
    }
  }

  // Unresolved: keep per-unit subtotals so the UI can offer "set a conversion".
  const perUnit = new Map<Unit, number>();
  for (const m of members) {
    perUnit.set(m.unit, (perUnit.get(m.unit) ?? 0) + m.quantity);
  }
  const subTotals = [...perUnit.entries()].map(([unit, quantity]) => ({
    unit,
    quantity: round6(quantity),
  }));
  const memberContribs: Contribution[] = members.map((m) => ({
    ref: m.ref,
    quantity: m.quantity,
    unit: m.unit,
    contributedQuantity: null,
  }));

  return {
    ...base,
    totalQuantity: null,
    unit: null,
    unresolved: true,
    subTotals,
    contributions: [...memberContribs, ...contributions],
    purchase: null,
  };
}

function tryResolve(
  members: Member[],
  target: Unit,
  info: CanonicalInfo | undefined,
): { total: number; converted: number[] } | null {
  const converted: number[] = [];
  let total = 0;
  for (const m of members) {
    const r = convert(m.quantity, m.unit, target, info ?? {});
    if (!r.ok) return null;
    converted.push(r.quantity);
    total += r.quantity;
  }
  return { total, converted };
}

/**
 * The unit of the largest-quantity member. Magnitudes are compared via each
 * unit's base factor (ml for volume, g for mass) so same-dimension members
 * compare correctly without needing density; count/vague fall back to raw
 * quantity.
 */
function largestUnit(members: Member[]): Unit {
  let bestUnit: Unit = (members[0] as Member).unit;
  let bestVal = -Infinity;
  for (const m of members) {
    const val = m.quantity * (UNIT_META[m.unit].toBase ?? 1);
    if (val > bestVal) {
      bestVal = val;
      bestUnit = m.unit;
    }
  }
  return bestUnit;
}

function round6(n: number): number {
  return Number(n.toFixed(6));
}
