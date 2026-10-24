/**
 * Tests for a status cell whose record has no link (possible only with a
 * custom source rule; fooboard#25 follow-up): Tab reaches it, its tooltip
 * says Space opens its details, Enter or Space opens the detail sheet as
 * on an empty cell, and Tab goes on to the sheet's *Copy*.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import type { CellResult } from '@/domain/derivation/cell';
import type { BoardModel } from '@/engine';
import { TEST_LAYOUT } from '@/test/boardLayout';
import { fullModel } from '@/test/boardModel';
import { tab } from '@/test/focus';

import { BoardGrid } from './BoardGrid';

let model: BoardModel;

/** The demo's first *Passed, dev* cell, without its link. */
const CELL = /^Passed, dev/;

beforeAll(async () => {
  const full = await fullModel(demoDashboard);
  const entry = Object.entries(full.cells).find(([, c]) => {
    const d = c?.derivation;
    return d?.kind === 'ok' && d.status.name === 'Passed' && d.branch === 'dev';
  });
  const cell = entry?.[1];
  if (!entry || cell?.derivation.kind !== 'ok')
    throw new Error('no Passed dev cell');
  const derivation: CellResult = { ...cell.derivation };
  delete derivation.linkUrl;
  model = {
    ...full,
    cells: { ...full.cells, [entry[0]]: { ...cell, derivation } },
  };
});

const renderBoard = () =>
  render(
    <MemoryRouter>
      <BoardGrid
        dashboard={demoDashboard}
        model={model}
        layout={TEST_LAYOUT}
        now={0}
      />
    </MemoryRouter>,
  );

/** Tab from `from` until `found` holds (at most 500 presses). */
const tabUntil = (from: Element, found: (el: HTMLElement) => boolean) => {
  let el = tab(from);
  for (let i = 0; i < 500 && !found(el); i++) el = tab(el);
  return el;
};

/** Tab from the start of the page until the unlinked cell has focus. */
const tabToCell = (): HTMLElement =>
  tabUntil(
    document.body,
    (el) =>
      CELL.test(el.getAttribute('aria-label') ?? '') && el.tagName === 'BUTTON',
  );

describe('a status cell without a link', () => {
  it.each([
    ['Space', ' '],
    ['Enter', 'Enter'],
  ])(
    'is reached with Tab, hints at Space, and opens its sheet on %s',
    (_, key) => {
      renderBoard();
      const cell = tabToCell();
      expect(cell).toHaveFocus();
      expect(cell).toHaveAttribute('aria-keyshortcuts', 'Space');
      expect(screen.getByRole('tooltip')).toHaveTextContent(
        'Press Space for details',
      );
      // A button: the browser turns Enter and Space into a click.
      fireEvent.keyDown(cell, { key });
      fireEvent.click(cell);
      const sheet = screen.getByRole('dialog', { name: 'Cell detail' });
      const copy = within(sheet).getByRole('button', {
        name: 'Copy the commit SHA',
      });
      expect(copy).toBeInTheDocument();
      expect(within(sheet).queryByText('Open job')).toBeNull();
    },
  );

  it('reaches Copy from the cell with Tab once the sheet is open', () => {
    renderBoard();
    const cell = tabToCell();
    fireEvent.click(cell);
    const sheet = screen.getByRole('dialog', { name: 'Cell detail' });
    const el = tabUntil(
      sheet,
      (e) =>
        e.getAttribute('aria-label') === 'Copy the commit SHA' ||
        !sheet.contains(e),
    );
    expect(el).toHaveAccessibleName('Copy the commit SHA');
  });
});
