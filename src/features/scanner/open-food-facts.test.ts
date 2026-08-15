import { describe, expect, it } from 'vitest';

import { parseOffProduct } from '@/features/scanner/open-food-facts';

describe('parseOffProduct', () => {
  it('returns the product name for a found product (no size)', () => {
    const out = parseOffProduct('123', { status: 1, product: { product_name: 'Whole Milk' } });
    expect(out).toEqual({ name: 'Whole Milk', barcode: '123', size: null });
  });

  it('parses the package size from the quantity string', () => {
    const out = parseOffProduct('123', {
      status: 1,
      product: { product_name: 'Enchilada Sauce', quantity: '32 oz' },
    });
    expect(out?.size).toEqual({ quantity: 32, unit: 'oz' });
  });

  it('leaves size null when the quantity string is missing or unparseable', () => {
    expect(
      parseOffProduct('123', { status: 1, product: { product_name: 'Beans' } })?.size,
    ).toBeNull();
    expect(
      parseOffProduct('123', { status: 1, product: { product_name: 'Beans', quantity: 'family size' } })
        ?.size,
    ).toBeNull();
  });

  it('prepends the brand when the name lacks it', () => {
    const out = parseOffProduct('123', {
      status: 1,
      product: { product_name: 'Corn Flakes', brands: 'Kellogg’s, Store Brand' },
    });
    expect(out?.name).toBe('Kellogg’s Corn Flakes');
  });

  it('does not double up a brand already in the name', () => {
    const out = parseOffProduct('123', {
      status: 1,
      product: { product_name: 'Cheerios Original', brands: 'Cheerios' },
    });
    expect(out?.name).toBe('Cheerios Original');
  });

  it('falls back to generic_name when product_name is missing', () => {
    const out = parseOffProduct('123', { status: 1, product: { generic_name: 'Olive oil' } });
    expect(out?.name).toBe('Olive oil');
  });

  it('returns null for not-found or empty responses', () => {
    expect(parseOffProduct('123', { status: 0 })).toBeNull();
    expect(parseOffProduct('123', { status: 1, product: { product_name: '' } })).toBeNull();
    expect(parseOffProduct('123', null)).toBeNull();
  });
});
