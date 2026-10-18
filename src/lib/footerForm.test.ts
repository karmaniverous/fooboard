/**
 * Tests for the footer's form (spec.md C-19): text while it fits, then
 * icons, then icons dropping out from the left; Privacy and Terms never go.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { footerForm } from './footerForm';

/** Ten items of 32 px, two of them legal; copyright 120 px. */
const icons = Array.from({ length: 10 }, () => 32);
const iconRow = (n: number) => n * 32 + (n - 1) * 4;
/** The room that leaves exactly `space` beside the copyright. */
const room = (space: number) => space + 120 + 24;

describe('footerForm', () => {
  it('shows text while the text fits', () => {
    expect(footerForm(room(600), 120, 600, icons, 2)).toBe(-1);
  });

  it('switches to icons when the text does not fit', () => {
    expect(footerForm(room(599), 120, 600, icons, 2)).toBe(0);
  });

  it('drops icons from the left as it narrows', () => {
    expect(footerForm(room(iconRow(10) - 1), 120, 600, icons, 2)).toBe(1);
    expect(footerForm(room(iconRow(7)), 120, 600, icons, 2)).toBe(3);
  });

  it('never drops Privacy and Terms', () => {
    expect(footerForm(room(10), 120, 600, icons, 2)).toBe(8);
  });
});
