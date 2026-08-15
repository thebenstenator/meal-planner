// Barcode → product name (and package size) via Open Food Facts (open, free, no
// key, CORS-enabled). The name seeds the "type and add" box; the size, when the
// crowd-sourced `quantity` string is parseable ("32 oz"), pre-fills the pantry
// package fields. The user reviews everything before it's saved.

import { parse } from '@/lib/ingredients/parse';

export interface ScannedProduct {
  /** Best display name we could derive (product name, optionally with brand). */
  name: string;
  barcode: string;
  /** Package size parsed from OFF's `quantity`, or null when absent/unparseable. */
  size: { quantity: number; unit: string } | null;
}

interface OffResponse {
  status?: number;
  product?: {
    product_name?: string;
    generic_name?: string;
    brands?: string;
    /** Free-text package size, e.g. "32 oz", "400 g", "1 L". */
    quantity?: string;
  };
}

/** Parse OFF's free-text quantity ("32 oz") into a size, or null. */
function parseSize(quantity: string | undefined): { quantity: number; unit: string } | null {
  if (!quantity) return null;
  const p = parse(quantity);
  if (p.quantity == null || p.unit == null) return null;
  return { quantity: p.quantity, unit: p.unit };
}

/** Pure: turn an Open Food Facts response into a name + size, or null if unusable. */
export function parseOffProduct(barcode: string, json: OffResponse | null): ScannedProduct | null {
  if (!json || json.status !== 1 || !json.product) return null;
  const p = json.product;
  const base = (p.product_name || p.generic_name || '').trim();
  if (!base) return null;
  // Prepend the first brand if the name doesn't already include it.
  const brand = (p.brands || '').split(',')[0]?.trim() ?? '';
  const name =
    brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${base}` : base;
  return { name, barcode, size: parseSize(p.quantity) };
}

/** Look up a scanned barcode. Returns null when not found or the request fails. */
export async function lookupBarcode(barcode: string): Promise<ScannedProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode,
  )}.json?fields=product_name,generic_name,brands,quantity`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return parseOffProduct(barcode, (await res.json()) as OffResponse);
  } catch {
    return null;
  }
}
