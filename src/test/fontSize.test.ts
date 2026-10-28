/**
 * Tests for the drawn-size helper the board text tests rely on: inline
 * sizes, Tailwind's named and arbitrary size classes, `em` of the parent,
 * custom properties, inheritance, and failing loudly on a size it can't
 * read.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { textSizes } from './fontSize';

/** A board root at 13 px holding `html`; the texts and their sizes. */
function sizes(html: string): Record<string, number> {
  const root = document.createElement('div');
  root.style.fontSize = '13px';
  root.style.setProperty('--text-badge', '0.8em');
  root.innerHTML = html;
  return Object.fromEntries(textSizes(root).map((t) => [t.text, t.px]));
}

describe('textSizes', () => {
  it('reads inline sizes, size classes, ems of the parent and variables', () => {
    expect(
      sizes(`
        <span>plain</span>
        <span class="text-xs text-muted-foreground">named</span>
        <span class="text-[0.85em] font-semibold">arbitrary</span>
        <span class="text-[#fff]">colour<b class="text-[length:0.5em]">half</b></span>
        <span style="font-size: var(--text-badge)">variable</span>
        <span style="font-size: 2em"><i>nested</i></span>
      `),
    ).toEqual({
      plain: 13,
      named: 12,
      arbitrary: 13 * 0.85,
      colour: 13,
      half: 6.5,
      variable: 13 * 0.8,
      nested: 26,
    });
  });

  it('fails on a variable nothing sets, or a size it cannot read', () => {
    expect(() =>
      sizes('<span style="font-size: var(--nowhere)">x</span>'),
    ).toThrow('--nowhere');
    expect(() => sizes('<span class="text-[1.2rem]">x</span>')).toThrow(
      'unreadable',
    );
  });

  it('fails when nothing above the text sets a size in px', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span>x</span>';
    expect(() => textSizes(root)).toThrow('no font size');
    root.style.fontSize = '1em';
    expect(() => textSizes(root)).toThrow('nothing above');
  });
});
