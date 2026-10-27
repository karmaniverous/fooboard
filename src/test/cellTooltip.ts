/**
 * Test helpers for a board cell's tooltip: its text, and the cell holding
 * a behind/diverged badge (the badge link and the cell's cover link).
 *
 * @module
 */
import { screen, within } from '@testing-library/react';

/** The tooltip's text, or null when it is closed. */
export const tooltipText = (): string | null =>
  screen.queryByRole('tooltip')?.textContent ?? null;

/** The first badge named `name` (by default the demo's billing row's
 * behind badge) and its cell's cover link. */
export const badgeCell = (
  name: RegExp = /^3 commits behind/,
): { badge: HTMLElement; cover: HTMLElement } => {
  const badge = screen.getAllByRole('link', { name })[0];
  const cell = badge.closest('[role="gridcell"]');
  if (!(cell instanceof HTMLElement)) throw new Error('no badge cell');
  return { badge, cover: within(cell).getAllByRole('link')[0] };
};
