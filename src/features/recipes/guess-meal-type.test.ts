import { describe, expect, it } from 'vitest';

import { guessMealTypes } from '@/features/recipes/guess-meal-type';

describe('guessMealTypes', () => {
  it('defaults an ordinary dish to main', () => {
    expect(guessMealTypes('Korean Beef Bulgogi')).toEqual(['main']);
    expect(guessMealTypes('Cafe Rio Sweet Pork')).toEqual(['main']);
    expect(guessMealTypes('PINEAPPLE CHICKEN AND RICE')).toEqual(['main']);
  });

  it('pulls sauces, dips and dressings out of the dinner pool', () => {
    expect(guessMealTypes('Gochujang Sauce')).toEqual(['sauce']);
    expect(guessMealTypes("Dad's Buffalo Sauce")).toEqual(['sauce']);
    expect(guessMealTypes("Chef Guy Fieri's Queso Dip")).toEqual(['sauce']);
    expect(guessMealTypes('Burger Sauce')).toEqual(['sauce']);
  });

  it('recognizes desserts', () => {
    expect(guessMealTypes('Deep Dark Chocolate Ice Cream')).toEqual(['dessert']);
    expect(guessMealTypes('Classic Butter Toffee')).toEqual(['dessert']);
    expect(guessMealTypes('Eclair Pie')).toEqual(['dessert']);
    expect(guessMealTypes('Super Soft Cinnamon Rolls')).toEqual(['dessert']);
    expect(guessMealTypes('Brian Lagerstrom Cheesecake')).toEqual(['dessert']);
  });

  it('reads drinks, but a dessert keyword wins over a drink one', () => {
    expect(guessMealTypes('Eggnog')).toEqual(['drink']);
    expect(guessMealTypes('Horchata')).toEqual(['drink']);
    // "cheesecake" (dessert) is checked before "eggnog" (drink).
    expect(guessMealTypes('Eggnog Cheesecake')).toEqual(['dessert']);
  });

  it('spots breakfast dishes', () => {
    expect(guessMealTypes('Basic Crepes')).toEqual(['breakfast']);
    expect(guessMealTypes('Brian Lagerstrom Everything Bagels')).toEqual(['breakfast']);
  });

  it('files breads and doughs as sides', () => {
    expect(guessMealTypes('The BEST Biscuits Recipe')).toEqual(['side']);
    expect(guessMealTypes('Dough Guy Pizza Dough')).toEqual(['side']);
    expect(guessMealTypes('Super thin Sonoran-style flour tortillas')).toEqual(['side']);
  });

  it('does not mistake substrings for whole words', () => {
    // "pancake" must not match the dessert keyword "cake"…
    expect(guessMealTypes('Fluffy Pancakes')).toEqual(['breakfast']);
    // …and "roll ups" is a main, not a side (no bare "roll" keyword).
    expect(guessMealTypes('Chicken Roll Ups')).toEqual(['main']);
    // A shepherd's pie is a main — "pie" is deliberately not a dessert keyword.
    expect(guessMealTypes("Brian Lagerstrom Shepherd's Pie")).toEqual(['main']);
    // Pizza is a main; only "pizza dough" is a side.
    expect(guessMealTypes('Grandma Pizza')).toEqual(['main']);
  });
});
