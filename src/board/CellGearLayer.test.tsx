/**
 * Tests for the board's one cell gear (spec.md §3.11 *The cell's gear*,
 * Decision 60): one gear for the whole grid, whatever its size, that
 * follows the cell under the pointer or keyboard focus, placed from the
 * cell's rect; out of the Tab order; `,` opening the focused cell's
 * popup; kept when the pointer moves onto it; and moved without
 * re-rendering a cell.
 *
 * @module
 */
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { type BoardModel, cellKey } from '@/engine';
import { fullModel } from '@/test/boardModel';
import { cellGear, shownCellGear } from '@/test/cellGear';
import { focusElement } from '@/test/focus';
import { renderSettingsBoard } from '@/test/settingsBoard';

import type * as CellModule from './Cell';
import type { CellProps } from './Cell';

/** Every render of a cell, counted. */
const renders = vi.hoisted(() => ({ count: 0 }));
vi.mock('./Cell', async (importOriginal) => {
  const actual = await importOriginal<typeof CellModule>();
  return {
    ...actual,
    Cell: (props: CellProps) => {
      renders.count += 1;
      return <actual.Cell {...props} />;
    },
  };
});

let model: BoardModel;
beforeAll(async () => {
  model = await fullModel(demoDashboard);
});
beforeEach(() => {
  renders.count = 0;
});

const cellGears = () =>
  document.querySelectorAll('button[aria-label^="Settings for cell "]');
const gridCells = () => screen.getAllByRole('gridcell');
const linkIn = (cell: HTMLElement) => within(cell).getAllByRole('link')[0];

/** Move a mouse onto a cell: its pointer and mouse events. */
const hover = (el: Element) => {
  fireEvent.pointerOver(el, { pointerType: 'mouse' });
  fireEvent.mouseEnter(el);
};

/** Give an element a rect (jsdom lays nothing out). */
const placeAt = (el: Element, x: number, y: number, w: number, h: number) => {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(x, y, w, h),
  );
};

/** Focus from the keyboard (not focus a click leaves behind). */
const tabTo = (el: HTMLElement) => {
  fireEvent.keyDown(document.body, { key: 'Tab' });
  focusElement(el);
};

/** The layer around the grid, where the gear lives. */
const layerOf = () => screen.getByRole('grid').parentElement ?? document.body;

const gearName = () => shownCellGear()?.getAttribute('aria-label');

describe('the cell gear', () => {
  it('is one gear for the whole grid, whatever its size', () => {
    for (const rows of [3, demoDashboard.rows.length]) {
      const { view } = renderSettingsBoard(
        {
          ...demoDashboard,
          rows: demoDashboard.rows.slice(0, rows),
          rowGroups: [],
        },
        model,
      );
      expect(gridCells()).toHaveLength(rows * demoDashboard.stages.length);
      for (const cell of gridCells().slice(0, 8)) {
        hover(cell);
        expect(cellGears()).toHaveLength(1);
      }
      view.unmount();
    }
  });

  it('moves to the hovered cell, laid over its top-right corner', () => {
    renderSettingsBoard(demoDashboard, model);
    const [first, second] = gridCells();
    placeAt(layerOf(), 10, 20, 900, 600);
    placeAt(second, 200, 60, 100, 30);
    hover(first);
    expect(gearName()).toBe('Settings for cell api-core, Bali');
    hover(second);
    expect(gearName()).toBe('Settings for cell api-core, Spokane');
    // Its right edge on the cell's (300 - 10), its top on the cell's
    // (60 - 20), each inset.
    expect(shownCellGear()?.style.transform).toBe(
      'translate(calc(290px - 100% - var(--gear-inset)), calc(40px + var(--gear-inset)))',
    );
    // Off the cells, it goes.
    hover(screen.getByRole('columnheader', { name: /Bali/ }));
    expect(shownCellGear()).toBeNull();
  });

  it('moves to the keyboard-focused cell, and back to it when the pointer leaves', () => {
    renderSettingsBoard(demoDashboard, model);
    const cells = gridCells();
    // Focus a click leaves behind doesn't take it.
    hover(cells[4]);
    focusElement(linkIn(cells[4]));
    fireEvent.pointerLeave(layerOf());
    expect(shownCellGear()).toBeNull();
    tabTo(linkIn(cells[2]));
    expect(gearName()).toBe('Settings for cell api-core, Texas');
    hover(cells[0]);
    expect(gearName()).toBe('Settings for cell api-core, Bali');
    // Focus moving again takes it back.
    tabTo(linkIn(cells[1]));
    expect(gearName()).toBe('Settings for cell api-core, Spokane');
    hover(cells[0]);
    fireEvent.pointerLeave(layerOf());
    expect(gearName()).toBe('Settings for cell api-core, Spokane');
    act(() => {
      linkIn(cells[1]).blur();
    });
    expect(shownCellGear()).toBeNull();
  });

  it('is not a Tab stop', () => {
    renderSettingsBoard(demoDashboard, model);
    hover(gridCells()[0]);
    expect(shownCellGear()?.tabIndex).toBe(-1);
  });

  it('opens the focused cell’s popup on comma, anchored to the gear', async () => {
    renderSettingsBoard(demoDashboard, model);
    const cells = gridCells();
    hover(cells[0]);
    // web-app (the second row) at Spokane.
    const link = linkIn(cells[demoDashboard.stages.length + 1]);
    tabTo(link);
    fireEvent.keyDown(link, { key: ',' });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Cell settings: web-app × Spokane');
    expect(shownCellGear()).toHaveAttribute('aria-expanded', 'true');
    expect(gearName()).toBe('Settings for cell web-app, Spokane');
    // Open, it stays put, whatever the pointer does.
    hover(cells[3]);
    expect(gearName()).toBe('Settings for cell web-app, Spokane');
  });

  it('has no place on a cell still loading', () => {
    const loading = cellKey('api-core', 'bali');
    renderSettingsBoard(demoDashboard, {
      ...model,
      cells: { ...model.cells, [loading]: undefined },
    });
    hover(gridCells()[0]);
    expect(shownCellGear()).toBeNull();
    hover(gridCells()[1]);
    expect(gearName()).toBe('Settings for cell api-core, Spokane');
  });

  it('stays when the pointer moves from the cell onto it', () => {
    renderSettingsBoard(demoDashboard, model);
    const cell = gridCells()[0];
    hover(cell);
    const gear = shownCellGear();
    if (!gear) throw new Error('no gear');
    hover(gear);
    fireEvent.mouseLeave(cell);
    expect(shownCellGear()).toBe(gear);
    expect(gearName()).toBe('Settings for cell api-core, Bali');
  });

  it('ignores a touch, where the detail sheet carries the gear', () => {
    renderSettingsBoard(demoDashboard, model);
    fireEvent.pointerOver(gridCells()[0], { pointerType: 'touch' });
    expect(shownCellGear()).toBeNull();
  });

  it('takes two clicks to open a cell’s popup while another is open: the first only closes it (Decision 60)', async () => {
    renderSettingsBoard(demoDashboard, model);
    fireEvent.click(
      screen.getByRole('button', { name: 'Settings for row api-core' }),
    );
    await screen.findByRole('dialog');
    // The modal popup takes the page's pointer events (it traps focus), so
    // no cell is hovered and the cell gear can't show under the pointer.
    expect(document.body.style.pointerEvents).toBe('none');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const cell = screen.getAllByRole('gridcell', { hidden: true })[1];
    fireEvent.pointerDown(cell, { button: 0, pointerType: 'mouse' });
    fireEvent.click(cell);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    // The second click is at the cell's gear.
    fireEvent.click(cellGear('Settings for cell api-core, Spokane'));
    expect(await screen.findByRole('dialog')).toHaveAccessibleName(
      'Cell settings: api-core × Spokane',
    );
  });

  it('moves without re-rendering a cell', () => {
    renderSettingsBoard(demoDashboard, model);
    const before = renders.count;
    expect(before).toBeGreaterThan(100);
    for (const cell of gridCells().slice(0, 12)) hover(cell);
    expect(gearName()).toBeDefined();
    expect(renders.count).toBe(before);
  });
});
