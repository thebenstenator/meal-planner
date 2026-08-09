import { describe, expect, it } from 'vitest';

import {
  cleanImportedText,
  stripControlChars,
  stripDecorativeGlyphs,
} from '@/lib/utils/sanitize-text';

const ch = (code: number) => String.fromCharCode(code);
const NUL = ch(0);
const BOX = ch(0x25a1); // □
const REPLACEMENT = ch(0xfffd); // �
const PUA = ch(0xe000);
const BULLET = ch(0x2022); // •
const HALF = ch(0x00bd); // ½
const DEGREE = ch(0x00b0); // °

describe('stripControlChars', () => {
  it('removes NUL bytes (the 22P05 culprit)', () => {
    expect(stripControlChars(`foo${NUL}bar`)).toBe('foobar');
    expect(stripControlChars(`${NUL}${NUL}`)).toBe('');
  });

  it('removes other control chars (bell, vertical tab, DEL)', () => {
    expect(stripControlChars(`a${ch(7)}b${ch(11)}c${ch(127)}d`)).toBe('abcd');
  });

  it('keeps tab, newline, and carriage return', () => {
    const s = `a${ch(9)}b${ch(10)}c${ch(13)}d`;
    expect(stripControlChars(s)).toBe(s);
  });

  it('leaves normal text untouched', () => {
    expect(stripControlChars('2 cups flour, sifted')).toBe('2 cups flour, sifted');
  });
});

describe('stripDecorativeGlyphs', () => {
  it('removes boxes, replacement chars, private-use symbols, and bullets', () => {
    expect(stripDecorativeGlyphs(`${BOX} 2 cups flour`)).toBe(' 2 cups flour');
    expect(stripDecorativeGlyphs(`${REPLACEMENT}${PUA}${BULLET}x`)).toBe('x');
  });

  it('keeps recipe-meaningful characters (fractions, degree sign)', () => {
    expect(stripDecorativeGlyphs(`${HALF} cup sugar`)).toBe(`${HALF} cup sugar`);
    expect(stripDecorativeGlyphs(`bake at 350${DEGREE}F`)).toBe(`bake at 350${DEGREE}F`);
  });
});

describe('cleanImportedText', () => {
  it('strips glyphs and collapses the leftover spacing', () => {
    expect(cleanImportedText(`${BOX} 2 cups flour`)).toBe('2 cups flour');
    expect(cleanImportedText(`${BULLET}  1 cup   sugar`)).toBe('1 cup sugar');
  });

  it('keeps newlines and fractions', () => {
    expect(cleanImportedText(`step 1${NUL}\nstep 2`)).toBe('step 1\nstep 2');
    expect(cleanImportedText(`${HALF} tsp salt`)).toBe(`${HALF} tsp salt`);
  });
});
