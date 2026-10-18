/**
 * Tests for the footer's form (spec.md C-19): text while it fits, then
 * icons, then icons dropping out from the left; Privacy and Terms never go.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { footerForm } from './footerForm';

/** Ten icons, laid out 36 px apart (32 px icon, 4 px gap); the last two
 * are legal. */
const starts = Array.from({ length: 10 }, (_, i) => i * 36);
const rowWidth = 9 * 36 + 32;
/** The width of the row with its first `dropped` icons gone. */
const rest = (dropped: number) => rowWidth - dropped * 36;
const form = (space: number, text = 600) =>
  footerForm(space, text, starts, rowWidth, 2);

describe('footerForm', () => {
  it('shows text while the text fits', () => {
    expect(form(600)).toBe(-1);
  });

  it('switches to icons when the text does not fit but every icon does', () => {
    expect(form(599)).toBe(0);
    expect(form(rest(0), 900)).toBe(0);
  });

  it('drops icons from the left, by their laid-out positions', () => {
    expect(form(rest(0) - 1, 900)).toBe(1);
    expect(form(rest(3), 900)).toBe(3);
    expect(form(rest(3) - 1, 900)).toBe(4);
  });

  it('never drops Privacy and Terms', () => {
    expect(form(10, 900)).toBe(8);
  });
});
