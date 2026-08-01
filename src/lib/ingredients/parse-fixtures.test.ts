import { describe, expect, it } from 'vitest';

import { FIXTURE_LINES } from '@/lib/ingredients/fixtures/ingredient-lines';
import { parse } from '@/lib/ingredients/parse';

describe('parser fixtures', () => {
  it('has 200+ real ingredient lines (specs/05 requirement)', () => {
    expect(FIXTURE_LINES.length).toBeGreaterThanOrEqual(200);
  });

  it('never throws and always yields a non-empty name', () => {
    for (const line of FIXTURE_LINES) {
      const p = parse(line);
      expect(p.name.length, `empty name for: ${line}`).toBeGreaterThan(0);
      expect(p.raw).toBe(line);
      if (p.quantity !== null) {
        expect(Number.isFinite(p.quantity), `bad quantity for: ${line}`).toBe(true);
      }
    }
  });

  it('matches the committed parse snapshot', () => {
    const parsed = FIXTURE_LINES.map((line) => {
      const p = parse(line);
      return {
        raw: p.raw,
        quantity: p.quantity,
        unit: p.unit,
        name: p.name,
        descriptor: p.descriptor,
        isOptional: p.isOptional,
        confidence: p.confidence,
      };
    });
    expect(parsed).toMatchSnapshot();
  });
});
