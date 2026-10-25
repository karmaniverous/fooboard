/**
 * Test helpers for the board's one cell gear (spec.md §3.11,
 * `CellGearLayer`): the gear as it is now, and the gear of a named cell,
 * brought to that cell by moving the pointer over the board's cells in
 * turn, as a mouse would.
 *
 * @module
 */
import { fireEvent, waitFor } from '@testing-library/react';

/** The board's cell gear, if it is showing (it is out of the Tab order). */
export const shownCellGear = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(
    'button[aria-label^="Settings for cell "]',
  );

/** Point at the board's cells until the cell gear has this name. */
export function cellGear(name: string): HTMLElement {
  for (const cell of document.querySelectorAll('[data-gear-row]')) {
    fireEvent.pointerOver(cell);
    const gear = shownCellGear();
    if (gear?.getAttribute('aria-label') === name) return gear;
  }
  throw new Error(`No cell gear named ${name}`);
}

/** `cellGear`, once the board has loaded. */
export const findCellGear = (name: string): Promise<HTMLElement> =>
  waitFor(() => cellGear(name));
