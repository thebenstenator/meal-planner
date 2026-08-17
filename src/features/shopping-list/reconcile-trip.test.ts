import { describe, expect, it } from 'vitest';

import { reconcileTrip, type ReconcileItem, type ReconcileLine } from '@/features/shopping-list/reconcile-trip';

const line = (raw: string, canonicalId: string | null = null): ReconcileLine => ({ raw, canonicalId });

const item = (
  id: string,
  displayName: string,
  isChecked: boolean,
  canonicalId: string | null = null,
): ReconcileItem => ({ id, displayName, canonicalId, isChecked });

describe('reconcileTrip', () => {
  it('confirms a checked item matched by canonical id', () => {
    const r = reconcileTrip([line('GV CRM CHEESE', 'c1')], [item('i1', 'cream cheese', true, 'c1')]);
    expect(r.confirmed).toHaveLength(1);
    expect(r.confirmed[0]?.item.id).toBe('i1');
    expect(r.missed).toEqual([]);
    expect(r.offList).toEqual([]);
    expect(r.unreceipted).toEqual([]);
  });

  it('flags a bought-but-unticked item as missed', () => {
    const r = reconcileTrip([line('cream cheese', 'c1')], [item('i1', 'cream cheese', false, 'c1')]);
    expect(r.missed).toHaveLength(1);
    expect(r.confirmed).toEqual([]);
  });

  it('matches on name when there is no canonical id on either side', () => {
    // Receipts pad the name with brand and size.
    const r = reconcileTrip([line('Philadelphia Cream Cheese 8oz')], [item('i1', 'cream cheese', true)]);
    expect(r.confirmed).toHaveLength(1);
  });

  it('reports receipt lines with no list match as off-list', () => {
    const r = reconcileTrip([line('tortilla chips'), line('sour cream')], [item('i1', 'rice', true)]);
    expect(r.offList.map((l) => l.raw)).toEqual(['tortilla chips', 'sour cream']);
    expect(r.unreceipted.map((i) => i.id)).toEqual(['i1']);
  });

  it('leaves unchecked items alone when the receipt has nothing like them', () => {
    // Still on the list, still needed — not an anomaly to report.
    const r = reconcileTrip([], [item('i1', 'rice', false)]);
    expect(r.unreceipted).toEqual([]);
    expect(r.offList).toEqual([]);
  });

  it('lets a canonical match win the item over an earlier fuzzy name match', () => {
    // "milk" would otherwise be claimed by the oat milk line that comes first.
    const lines = [line('oat milk'), line('MILK WHOLE GAL', 'c-milk')];
    const items = [item('i1', 'milk', true, 'c-milk')];
    const r = reconcileTrip(lines, items);
    expect(r.confirmed).toHaveLength(1);
    expect(r.confirmed[0]?.line.raw).toBe('MILK WHOLE GAL');
    expect(r.offList.map((l) => l.raw)).toEqual(['oat milk']);
  });

  it('claims each item only once', () => {
    const r = reconcileTrip([line('bananas'), line('bananas')], [item('i1', 'bananas', true)]);
    expect(r.confirmed).toHaveLength(1);
    expect(r.offList).toHaveLength(1);
  });

  it('does not match on a fragment too short to mean anything', () => {
    // "ea" (each) appearing inside "bread" is a coincidence, not a match.
    const r = reconcileTrip([line('ea')], [item('i1', 'bread', true)]);
    expect(r.offList).toHaveLength(1);
    expect(r.confirmed).toEqual([]);
  });
});
