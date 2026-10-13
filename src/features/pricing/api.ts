import { invokeAiFunction } from '@/features/recipes/import';
import { supabase } from '@/lib/supabase/client';

export const pricingKeys = {
  stores: (householdId: string) => ['stores', householdId] as const,
  settings: (householdId: string) => ['pricing-settings', householdId] as const,
  currentPrices: (storeId: string) => ['current-prices', storeId] as const,
  referencePrices: () => ['reference-prices'] as const,
  householdEstimates: (householdId: string) => ['household-price-estimates', householdId] as const,
  conversions: (ids: string[]) => ['conversion-infos', ids] as const,
  openChecked: (householdId: string, start: string, end: string) =>
    ['open-checked-items', householdId, start, end] as const,
  /**
   * Query-key prefixes for every price/spend-derived query — invalidate all of
   * these after new prices, a trip, or a clear land, so the budget bar and
   * spending page refresh. Single source of truth for the heads shared across
   * features.
   */
  spendAffected: () =>
    [['current-prices'], ['open-checked-items'], ['trip-totals']] as const,
};

export interface Store {
  id: string;
  name: string;
}

export interface PricingSettings {
  defaultStoreId: string | null;
  priceStaleDays: number;
}

export interface CurrentPrice {
  canonicalId: string;
  priceCents: number;
  packageQuantity: number;
  packageUnit: string;
  observedOn: string;
}

export async function listStores(householdId: string): Promise<Store[]> {
  const { data, error } = await supabase
    .from('store')
    .select('id, name')
    .eq('household_id', householdId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getPricingSettings(householdId: string): Promise<PricingSettings> {
  const { data, error } = await supabase
    .from('household')
    .select('default_store_id, price_stale_days')
    .eq('id', householdId)
    .single();
  if (error) throw error;
  return { defaultStoreId: data.default_store_id, priceStaleDays: data.price_stale_days };
}

export async function createStore(householdId: string, name: string): Promise<string> {
  const { data, error } = await supabase
    .from('store')
    .insert({ household_id: householdId, name })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function renameStore(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('store').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteStore(id: string): Promise<void> {
  const { error } = await supabase.from('store').delete().eq('id', id);
  if (error) throw error;
}

export async function setDefaultStore(
  householdId: string,
  storeId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('household')
    .update({ default_store_id: storeId })
    .eq('id', householdId);
  if (error) throw error;
}

export async function setPriceStaleDays(householdId: string, days: number): Promise<void> {
  const { error } = await supabase
    .from('household')
    .update({ price_stale_days: days })
    .eq('id', householdId);
  if (error) throw error;
}

/** Append a new price observation. price_record is append-only. */
export async function addPriceRecord(
  householdId: string,
  input: {
    canonicalId: string;
    storeId: string;
    priceCents: number;
    packageQuantity: number;
    packageUnit: string;
    source?: 'manual' | 'receipt_ocr' | 'estimated';
  },
): Promise<void> {
  const { error } = await supabase.from('price_record').insert({
    household_id: householdId,
    canonical_ingredient_id: input.canonicalId,
    store_id: input.storeId,
    price_cents: input.priceCents,
    package_quantity: input.packageQuantity,
    package_unit: input.packageUnit,
    source: input.source ?? 'manual',
  });
  if (error) throw error;
}

export interface ConversionRow {
  canonicalId: string;
  densityGPerMl: number | null;
  countToGram: number | null;
}

/**
 * Fetch density/count facts for a set of canonical ingredients (for pricing
 * conversions). Returns a plain array (not a Map) so it stays intact when the
 * query cache is persisted to localStorage — a Map JSON-round-trips to `{}`.
 */
export async function fetchConversionInfos(ids: string[]): Promise<ConversionRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('canonical_ingredient')
    .select('id, density_g_per_ml, count_to_gram')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    canonicalId: c.id,
    densityGPerMl: c.density_g_per_ml,
    countToGram: c.count_to_gram,
  }));
}

/**
 * Canonical names by id. A plain object, not a Map, because this is query data:
 * the cache is persisted to localStorage, and a Map comes back as `{}` whose
 * `.get` throws. Same reason as PantryPrefs; see persister.ts v5.
 */
export async function fetchCanonicalNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from('canonical_ingredient')
    .select('id, name')
    .in('id', ids);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((c) => [c.id, c.name]));
}

export async function getCurrentPrices(storeId: string): Promise<CurrentPrice[]> {
  const { data, error } = await supabase.rpc('get_current_prices', { p_store_id: storeId });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    canonicalId: p.canonical_ingredient_id,
    priceCents: p.price_cents,
    packageQuantity: p.package_quantity,
    packageUnit: p.package_unit,
    observedOn: p.observed_on,
  }));
}

/** Where a price came from: the household's own store, or the shared reference. */
export type PriceSource = 'store' | 'reference';

export interface EffectivePrice extends CurrentPrice {
  source: PriceSource;
}

/**
 * Typical US prices for the shared ingredients (ADR 0021) — the fallback when a
 * household hasn't priced something at its store. `observedOn` is the as-of date.
 */
export async function fetchReferencePrices(): Promise<CurrentPrice[]> {
  const { data, error } = await supabase
    .from('reference_price')
    .select('canonical_ingredient_id, price_cents, package_quantity, package_unit, as_of');
  if (error) throw error;
  return (data ?? []).map((p) => ({
    canonicalId: p.canonical_ingredient_id,
    priceCents: p.price_cents,
    packageQuantity: Number(p.package_quantity),
    packageUnit: p.package_unit,
    observedOn: p.as_of,
  }));
}

/** A household's AI price estimates (ADR 0022) — used like reference prices. */
export async function fetchHouseholdEstimates(householdId: string): Promise<CurrentPrice[]> {
  const { data, error } = await supabase
    .from('household_price_estimate')
    .select('canonical_ingredient_id, price_cents, package_quantity, package_unit, estimated_at')
    .eq('household_id', householdId);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    canonicalId: p.canonical_ingredient_id,
    priceCents: p.price_cents,
    packageQuantity: Number(p.package_quantity),
    packageUnit: p.package_unit,
    observedOn: p.estimated_at.slice(0, 10),
  }));
}

interface AiEstimate {
  id: string;
  price_cents: number;
  package_quantity: number;
  package_unit: string;
}

/**
 * Ask the premium estimate-prices function for typical prices, then save them
 * for the household (re-estimating replaces). Returns how many were saved —
 * the function drops any it couldn't express in a usable unit.
 */
export async function requestAiEstimates(
  householdId: string,
  canonicalIds: string[],
): Promise<number> {
  const { estimates } = await invokeAiFunction<{ estimates: AiEstimate[] }>(
    'estimate-prices',
    { household_id: householdId, canonical_ids: canonicalIds },
    'Could not estimate those prices',
  );
  if (estimates.length === 0) return 0;
  const { error } = await supabase.from('household_price_estimate').upsert(
    estimates.map((e) => ({
      household_id: householdId,
      canonical_ingredient_id: e.id,
      price_cents: e.price_cents,
      package_quantity: e.package_quantity,
      package_unit: e.package_unit,
      estimated_at: new Date().toISOString(),
    })),
    { onConflict: 'household_id,canonical_ingredient_id' },
  );
  if (error) throw error;
  return estimates.length;
}
