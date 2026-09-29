import { describe, expect, it } from 'vitest';

import { withGroupHeadings } from './ingredient-groups.ts';

// Shaped like WP Recipe Maker's output (The Loopy Whisk, and most WordPress
// recipe blogs): note the group-name class also starts with the group class.
function wprmGroup(name: string | null, items: string[]): string {
  const heading = name
    ? `<h4 class="wprm-recipe-group-name wprm-recipe-ingredient-group-name wprm-block-text-bold">${name}</h4>`
    : '';
  const lis = items
    .map(
      (t, i) =>
        `<li class="wprm-recipe-ingredient" style="list-style-type: disc;" data-uid="${i}"><span class="wprm-recipe-ingredient-name">${t}</span></li>`,
    )
    .join('');
  return `<div class="wprm-recipe-ingredient-group">${heading}<ul class="wprm-recipe-ingredients">${lis}</ul></div>`;
}

const curd = ['100 g (½ cup) caster sugar', 'zest of 1 lemon', '3 egg yolks'];
const cookies = ['150 g (¾ cup) caster sugar', 'zest of 2 lemons'];

describe('withGroupHeadings', () => {
  it('re-inserts WP Recipe Maker group headings', () => {
    const html = `<div class="wprm-recipe-ingredients-container">${wprmGroup('Lemon curd:', curd)}${wprmGroup('Lemon cookies:', cookies)}</div>`;
    expect(withGroupHeadings(html, [...curd, ...cookies])).toEqual([
      'Lemon curd:',
      ...curd,
      'Lemon cookies:',
      ...cookies,
    ]);
  });

  it('decodes entities and handles an unnamed first group', () => {
    const html =
      wprmGroup(null, ['1 onion']) + wprmGroup('Sauce &amp; glaze', ['2 tbsp soy sauce']);
    expect(withGroupHeadings(html, ['1 onion', '2 tbsp soy sauce'])).toEqual([
      '1 onion',
      'Sauce & glaze:',
      '2 tbsp soy sauce',
    ]);
  });

  it('re-inserts Tasty Recipes headings, ignoring the body title', () => {
    const html = `<div class="tasty-recipes-ingredients"><h3>Ingredients</h3><div class="tasty-recipes-ingredients-body">
      <h4>For the crust</h4><ul><li>1 cup flour</li><li>1/2 cup butter</li></ul>
      <h4>For the filling</h4><ul><li>2 eggs</li></ul></div></div>
      <div class="tasty-recipes-instructions"><ol><li>Mix.</li></ol></div>`;
    expect(withGroupHeadings(html, ['1 cup flour', '1/2 cup butter', '2 eggs'])).toEqual([
      'For the crust:',
      '1 cup flour',
      '1/2 cup butter',
      'For the filling:',
      '2 eggs',
    ]);
  });

  it('leaves lines alone when the counts disagree (e.g. two recipes on a page)', () => {
    const html = wprmGroup('Lemon curd:', curd) + wprmGroup('Lemon cookies:', cookies);
    expect(withGroupHeadings(html, curd)).toEqual(curd);
  });

  it('leaves lines alone when no group is named, or there is no plugin markup', () => {
    expect(withGroupHeadings(wprmGroup(null, curd), curd)).toEqual(curd);
    expect(withGroupHeadings('<ul><li>x</li></ul>', ['x'])).toEqual(['x']);
  });
});
