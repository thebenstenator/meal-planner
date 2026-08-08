// Barcode → product name via Open Food Facts (open, free, no key, CORS-enabled).
// We only need a human name to seed the "type and add" box; the user reviews it
// before it becomes a pantry/list item, so a rough name is fine.

export interface ScannedProduct {
  /** Best display name we could derive (product name, optionally with brand). */
  name: string;
  barcode: string;
}

interface OffResponse {
  status?: number;
  product?: {
    product_name?: string;
    generic_name?: string;
    brands?: string;
  };
}

/** Pure: turn an Open Food Facts response into a name, or null if not usable. */
export function parseOffProduct(barcode: string, json: OffResponse | null): ScannedProduct | null {
  if (!json || json.status !== 1 || !json.product) return null;
  const p = json.product;
  const base = (p.product_name || p.generic_name || '').trim();
  if (!base) return null;
  // Prepend the first brand if the name doesn't already include it.
  const brand = (p.brands || '').split(',')[0]?.trim() ?? '';
  const name =
    brand && !base.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${base}` : base;
  return { name, barcode };
}

/** Look up a scanned barcode. Returns null when not found or the request fails. */
export async function lookupBarcode(barcode: string): Promise<ScannedProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode,
  )}.json?fields=product_name,generic_name,brands`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return parseOffProduct(barcode, (await res.json()) as OffResponse);
  } catch {
    return null;
  }
}
