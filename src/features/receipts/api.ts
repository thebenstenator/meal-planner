import { matchCanonical } from '@/features/ingredients/api';
import { addPriceRecord } from '@/features/pricing/api';
import { invokeAiFunction } from '@/features/recipes/import';
import { supabase } from '@/lib/supabase/client';

export const receiptKeys = {
  trips: (householdId: string) => ['trips', householdId] as const,
  tripTotals: (householdId: string, start: string, end: string) =>
    ['trip-totals', householdId, start, end] as const,
  /** Trips with their lines, for the monthly breakdown. Shares the tripTotals prefix. */
  tripLines: (householdId: string, start: string, end: string) =>
    ['trip-totals', 'lines', householdId, start, end] as const,
  /** Prefix that matches every tripTotals query, for range-agnostic invalidation. */
  tripTotalsAll: () => ['trip-totals'] as const,
};

export interface ParsedReceiptLine {
  description: string;
  quantity: number | null;
  unit: string | null;
  totalPriceCents: number | null;
  unitPriceCents: number | null;
}

export interface ParsedReceipt {
  storeName: string | null;
  purchasedOn: string | null;
  totalCents: number | null;
  lineItems: ParsedReceiptLine[];
}

/** One reviewable receipt line: parsed + matched, editable before saving. */
export interface ReceiptLineDraft {
  raw: string;
  parsedName: string;
  canonicalId: string | null;
  canonicalName: string | null;
  quantity: number | null;
  unit: string | null;
  /** Line total, integer cents. */
  priceCents: number | null;
  needsReview: boolean;
}

interface ReceiptResponse {
  receipt: {
    store_name: string | null;
    purchased_on: string | null;
    total_cents: number | null;
    line_items: {
      description: string;
      quantity: number | null;
      unit: string | null;
      total_price_cents: number | null;
      unit_price_cents: number | null;
    }[];
  };
}

/** Call the parse-receipt Edge Function (Anthropic key stays server-side, metered). */
export async function parseReceiptImages(
  householdId: string,
  images: { media_type: string; data: string }[],
): Promise<ParsedReceipt> {
  const data = await invokeAiFunction<ReceiptResponse>(
    'parse-receipt',
    { images, household_id: householdId },
    'Could not read that receipt',
  );
  const r = data.receipt;
  return {
    storeName: r.store_name,
    purchasedOn: r.purchased_on,
    totalCents: r.total_cents,
    lineItems: r.line_items.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      totalPriceCents: l.total_price_cents,
      unitPriceCents: l.unit_price_cents,
    })),
  };
}

/** Match each parsed line to a canonical ingredient; flag unmatched for review. */
export async function toReceiptDrafts(
  householdId: string,
  parsed: ParsedReceipt,
): Promise<ReceiptLineDraft[]> {
  return Promise.all(
    parsed.lineItems.map(async (line) => {
      const match = await matchCanonical(householdId, line.description).catch(() => null);
      return {
        raw: line.description,
        parsedName: line.description,
        canonicalId: match?.canonicalIngredientId ?? null,
        canonicalName: match?.name ?? null,
        quantity: line.quantity,
        unit: line.unit,
        priceCents: line.totalPriceCents,
        needsReview: match === null,
      };
    }),
  );
}

export interface SaveTripInput {
  storeId: string | null;
  purchasedOn: string; // yyyy-MM-dd
  totalCents: number;
  note: string | null;
  lines: ReceiptLineDraft[];
  /**
   * Shopping-list items this trip accounts for. They're linked to the trip so
   * their estimates stop counting as spend on top of its total (ADR 0016).
   */
  coversItemIds?: string[];
}

/**
 * Persist a reviewed receipt: create the grocery_trip (logs actual spend), its
 * line items, and — for matched lines with a price and a chosen store — append a
 * price_record so future budget estimates get more accurate. Links any list
 * items the trip covers. Returns the trip id.
 */
export async function saveTrip(householdId: string, input: SaveTripInput): Promise<string> {
  const { data: trip, error: tripErr } = await supabase
    .from('grocery_trip')
    .insert({
      household_id: householdId,
      store_id: input.storeId,
      purchased_on: input.purchasedOn,
      total_cents: input.totalCents,
      note: input.note,
    })
    .select('id')
    .single();
  if (tripErr) throw tripErr;
  const tripId = trip.id as string;

  const rows = input.lines.map((l, i) => ({
    trip_id: tripId,
    household_id: householdId,
    raw_text: l.raw,
    canonical_ingredient_id: l.canonicalId,
    quantity: l.quantity,
    unit: l.unit,
    price_cents: l.priceCents,
    position: i,
  }));
  if (rows.length > 0) {
    const { error: linesErr } = await supabase.from('trip_line_item').insert(rows);
    if (linesErr) throw linesErr;
  }

  if (input.coversItemIds && input.coversItemIds.length > 0) {
    const { error: linkErr } = await supabase
      .from('shopping_list_item')
      .update({ trip_id: tripId })
      .in('id', input.coversItemIds);
    if (linkErr) throw linkErr;
  }

  // Feed prices only when we have a store, a match, and a line price.
  if (input.storeId) {
    for (const l of input.lines) {
      if (!l.canonicalId || l.priceCents == null) continue;
      await addPriceRecord(householdId, {
        canonicalId: l.canonicalId,
        storeId: input.storeId,
        priceCents: l.priceCents,
        packageQuantity: l.quantity && l.quantity > 0 ? l.quantity : 1,
        packageUnit: l.unit || 'each',
        source: 'receipt_ocr',
      });
    }
  }

  return tripId;
}

export interface TripSummary {
  id: string;
  purchasedOn: string;
  totalCents: number;
  storeName: string | null;
  itemCount: number;
  /** Archived from checked items on clear, priced from estimates. */
  isEstimated: boolean;
}

/** Recent trips for the trip log, newest first. */
export async function listTrips(householdId: string): Promise<TripSummary[]> {
  const { data, error } = await supabase
    .from('grocery_trip')
    .select(
      'id, purchased_on, total_cents, is_estimated, store(name), trip_line_item(count)',
    )
    .eq('household_id', householdId)
    .order('purchased_on', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    purchasedOn: t.purchased_on,
    totalCents: t.total_cents,
    storeName: t.store?.name ?? null,
    itemCount: t.trip_line_item?.[0]?.count ?? 0,
    isEstimated: t.is_estimated,
  }));
}

export async function deleteTrip(id: string): Promise<void> {
  const { error } = await supabase.from('grocery_trip').delete().eq('id', id);
  if (error) throw error;
}

export interface TripTotal {
  purchasedOn: string;
  totalCents: number;
}

/** Trip totals within [start, end] (inclusive) — feeds actual-spend rollups. */
export async function fetchTripTotalsInRange(
  householdId: string,
  start: string,
  end: string,
): Promise<TripTotal[]> {
  const { data, error } = await supabase
    .from('grocery_trip')
    .select('purchased_on, total_cents')
    .eq('household_id', householdId)
    .gte('purchased_on', start)
    .lte('purchased_on', end);
  if (error) throw error;
  return (data ?? []).map((t) => ({ purchasedOn: t.purchased_on, totalCents: t.total_cents }));
}

export interface TripWithLines {
  totalCents: number;
  isEstimated: boolean;
  lines: Array<{
    rawText: string;
    canonicalId: string | null;
    /** The canonical ingredient's own category, before household overrides. */
    canonicalCategory: string | null;
    priceCents: number | null;
  }>;
}

/** Trips purchased within [start, end] with their line items — where the money went. */
export async function fetchTripsWithLines(
  householdId: string,
  start: string,
  end: string,
): Promise<TripWithLines[]> {
  const { data, error } = await supabase
    .from('grocery_trip')
    .select(
      'total_cents, is_estimated, trip_line_item(raw_text, canonical_ingredient_id, price_cents, canonical_ingredient(category))',
    )
    .eq('household_id', householdId)
    .gte('purchased_on', start)
    .lte('purchased_on', end);
  if (error) throw error;
  return (data ?? []).map((t) => ({
    totalCents: t.total_cents,
    isEstimated: t.is_estimated,
    lines: (t.trip_line_item ?? []).map((l) => ({
      rawText: l.raw_text,
      canonicalId: l.canonical_ingredient_id,
      canonicalCategory: l.canonical_ingredient?.category ?? null,
      priceCents: l.price_cents,
    })),
  }));
}
