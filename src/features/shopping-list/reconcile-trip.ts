// Matching a scanned receipt against the shopping list it came from.
//
// Four outcomes matter at the end of a trip, and each one is a different thing
// to offer the shopper — so this returns them separately rather than a score:
// the expected case (bought it, ticked it), the forgotten tick, the impulse buy,
// and the thing you meant to buy but the receipt says you didn't.
//
// Pure and generic: callers pass their own line/item types and get them back, so
// this stays free of both the receipt and shopping-list modules.

/** The receipt side — `ReceiptLineDraft` satisfies this. */
export interface ReconcileLine {
  raw: string;
  canonicalId: string | null;
}

/** The list side — `ShoppingItem` satisfies this. */
export interface ReconcileItem {
  id: string;
  displayName: string;
  canonicalId: string | null;
  isChecked: boolean;
}

export interface TripReconciliation<L, I> {
  /** On the receipt and already ticked off. The boring, correct case. */
  confirmed: Array<{ line: L; item: I }>;
  /** On the receipt but still unticked — bought it and forgot to check it off. */
  missed: Array<{ line: L; item: I }>;
  /** On the receipt, nothing like it on the list — an off-list buy. */
  offList: L[];
  /** Ticked off but absent from the receipt — a wrong tick, or a second receipt. */
  unreceipted: I[];
}

/** Lowercase, strip punctuation, collapse whitespace. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Shortest string allowed to match by containment. Receipts pad names with
 * sizes and brands ("philadelphia cream cheese 8oz" ⊃ "cream cheese"), so
 * containment earns real matches — but unbounded it also makes "ea" match
 * "bread". Four characters is long enough for the overlap to mean something.
 */
const MIN_CONTAINMENT = 4;

function namesMatch(a: string, b: string): boolean {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= MIN_CONTAINMENT && y.includes(x)) return true;
  if (y.length >= MIN_CONTAINMENT && x.includes(y)) return true;
  return false;
}

/**
 * Pair receipt lines with list items, then sort both sides into the four
 * outcomes. Each item is claimed by at most one line.
 *
 * Deliberately precision-first: an unmatched line becomes a reviewable off-list
 * item, which the shopper simply declines. A *wrong* match silently attaches
 * someone else's price to an ingredient and poisons future estimates, so when
 * in doubt this doesn't match.
 */
export function reconcileTrip<L extends ReconcileLine, I extends ReconcileItem>(
  lines: L[],
  items: I[],
): TripReconciliation<L, I> {
  const claimed = new Set<string>();
  const pairs = new Map<L, I>();

  // Canonical ids across every line first, so a confident id match can't lose
  // its item to a fuzzy name match that happened to sit earlier in the receipt.
  for (const line of lines) {
    if (!line.canonicalId) continue;
    const hit = items.find((i) => i.canonicalId === line.canonicalId && !claimed.has(i.id));
    if (hit) {
      claimed.add(hit.id);
      pairs.set(line, hit);
    }
  }
  for (const line of lines) {
    if (pairs.has(line)) continue;
    const hit = items.find((i) => !claimed.has(i.id) && namesMatch(line.raw, i.displayName));
    if (hit) {
      claimed.add(hit.id);
      pairs.set(line, hit);
    }
  }

  const result: TripReconciliation<L, I> = {
    confirmed: [],
    missed: [],
    offList: [],
    unreceipted: [],
  };

  for (const line of lines) {
    const item = pairs.get(line);
    if (!item) result.offList.push(line);
    else if (item.isChecked) result.confirmed.push({ line, item });
    else result.missed.push({ line, item });
  }
  for (const item of items) {
    if (item.isChecked && !claimed.has(item.id)) result.unreceipted.push(item);
  }

  return result;
}
