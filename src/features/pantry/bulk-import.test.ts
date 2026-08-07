import { describe, expect, it } from 'vitest';

import { parsePantryLine } from '@/features/pantry/bulk-import';

describe('parsePantryLine', () => {
  it('parses a plain ingredient line', () => {
    expect(parsePantryLine('2 cups flour')).toEqual({ name: 'flour', quantity: 2, unit: 'cup' });
  });

  it('parses tab-separated columns (spreadsheet paste)', () => {
    expect(parsePantryLine('flour\t2\tcups')).toEqual({ name: 'flour', quantity: 2, unit: 'cup' });
  });

  it('parses comma-separated columns with a combined qty+unit', () => {
    expect(parsePantryLine('cream cheese, 8 oz')).toEqual({
      name: 'cream cheese',
      quantity: 8,
      unit: 'oz',
    });
  });

  it('parses a bare count as "each"', () => {
    expect(parsePantryLine('eggs\t12')).toEqual({ name: 'eggs', quantity: 12, unit: 'each' });
  });

  it('handles a bare name', () => {
    expect(parsePantryLine('milk')).toEqual({ name: 'milk', quantity: null, unit: null });
  });
});
