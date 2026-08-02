import { describe, expect, it } from 'vitest';

import { toCanonicalInfo, type CanonicalIngredient } from '@/features/ingredients/api';

const base: CanonicalIngredient = {
  id: 'x',
  householdId: null,
  name: 'cream cheese',
  aliases: ['philly'],
  category: 'dairy',
  defaultUnit: 'oz',
  densityGPerMl: null,
  unitSizeQuantity: 8,
  unitSizeUnit: 'oz',
  countToGram: null,
  mergedIntoId: null,
  isGlobal: true,
};

describe('toCanonicalInfo', () => {
  it('maps DB fields into the engine CanonicalInfo shape', () => {
    expect(toCanonicalInfo(base)).toEqual({
      id: 'x',
      name: 'cream cheese',
      category: 'dairy',
      defaultUnit: 'oz',
      densityGPerMl: undefined,
      countToGram: undefined,
      unitSize: { quantity: 8, unit: 'oz' },
    });
  });

  it('omits unitSize when the package size is incomplete', () => {
    const info = toCanonicalInfo({ ...base, unitSizeUnit: null });
    expect(info.unitSize).toBeUndefined();
  });
});
