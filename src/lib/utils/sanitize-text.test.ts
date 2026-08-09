import { describe, expect, it } from 'vitest';

import { stripControlChars } from '@/lib/utils/sanitize-text';

const ch = (code: number) => String.fromCharCode(code);
const NUL = ch(0);

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
