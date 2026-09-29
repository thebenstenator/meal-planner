import { describe, expect, it } from 'vitest';

import {
  assignSections,
  groupBySection,
  sectionHeading,
} from '@/features/recipes/sections';

describe('sectionHeading', () => {
  it('reads the common heading shapes', () => {
    expect(sectionHeading('Lemon curd:')).toBe('Lemon curd');
    expect(sectionHeading('Lemon cookies:')).toBe('Lemon cookies');
    expect(sectionHeading('For the frosting')).toBe('For the frosting');
    expect(sectionHeading('For the Frosting:')).toBe('For the Frosting');
    expect(sectionHeading('## Filling')).toBe('Filling');
    expect(sectionHeading('**Sauce**')).toBe('Sauce');
    expect(sectionHeading('LEMON CURD')).toBe('Lemon curd');
  });

  it('leaves real ingredient lines alone', () => {
    expect(sectionHeading('100 g (½ cup) caster sugar')).toBeNull();
    expect(sectionHeading('zest of 1 lemon')).toBeNull();
    expect(sectionHeading('¼ tsp salt')).toBeNull();
    expect(sectionHeading('salt and pepper')).toBeNull();
    expect(sectionHeading('Garnish: chopped parsley')).toBeNull();
    expect(sectionHeading('2 cups flour:')).toBeNull();
    expect(sectionHeading('')).toBeNull();
  });

  it('rejects long sentences that happen to end in a colon', () => {
    expect(
      sectionHeading(
        'You can also mix your own gluten free flour blend using this recipe:',
      ),
    ).toBeNull();
  });
});

describe('assignSections', () => {
  it('tags each ingredient with the heading above it and drops the headings', () => {
    expect(
      assignSections([
        '1 onion',
        'Lemon curd:',
        '100 g sugar',
        '',
        '3 egg yolks',
        'Lemon cookies:',
        '150 g sugar',
      ]),
    ).toEqual([
      { line: '1 onion', section: null },
      { line: '100 g sugar', section: 'Lemon curd' },
      { line: '3 egg yolks', section: 'Lemon curd' },
      { line: '150 g sugar', section: 'Lemon cookies' },
    ]);
  });

  it('is a no-op for a plain list', () => {
    expect(assignSections(['1 cup rice', '2 cups water'])).toEqual([
      { line: '1 cup rice', section: null },
      { line: '2 cups water', section: null },
    ]);
  });
});

describe('groupBySection', () => {
  it('groups consecutive runs and keeps original indexes', () => {
    const rows = [
      { id: 'a', section: 'Curd' },
      { id: 'b', section: 'Curd' },
      { id: 'c', section: 'Cookies' },
      { id: 'd', section: null },
    ];
    const groups = groupBySection(rows);
    expect(groups.map((g) => g.section)).toEqual(['Curd', 'Cookies', null]);
    expect(groups[0]?.items.map((i) => i.index)).toEqual([0, 1]);
    expect(groups[1]?.items.map((i) => i.row.id)).toEqual(['c']);
  });

  it('treats blank names as no section', () => {
    expect(groupBySection([{ section: '  ' }, { section: null }])).toHaveLength(1);
  });
});
