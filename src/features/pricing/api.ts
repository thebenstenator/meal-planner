import { supabase } from '@/lib/supabase/client';

export const pricingKeys = {
  stores: (householdId: string) => ['stores', householdId] as const,
  settings: (householdId: string) => ['pricing-settings', householdId] as const,
  currentPrices: (storeId: string) => ['current-prices', storeId] as const,
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

export async function fetchCanonicalNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from('canonical_ingredient')
    .select('id, name')
    .in('id', ids);
  if (error) throw error;
  for (const c of data ?? []) map.set(c.id, c.name);
  return map;
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
