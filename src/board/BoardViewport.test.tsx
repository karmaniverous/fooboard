/**
 * Tests for the board viewport: zoom buttons and keys change and save the
 * zoom, 100% and `0` return to the fitted layout, and density is saved;
 * on a touch device the board keeps its size when only the window's height
 * changes (iOS's address bar during a scroll), and a desktop follows it.
 *
 * @module
 */
import { fireEvent, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import { type BoardModel, emptyModel } from '@/engine';
import { fullModel } from '@/test/boardModel';
import { renderViewport } from '@/test/boardViewport';
import { fakeMediaQueries } from '@/test/mediaQuery';
import { fakeWindowSize } from '@/test/windowSize';

let demoModel: BoardModel = emptyModel();
beforeAll(async () => {
  demoModel = await fullModel(measureBoard);
});

const setup = renderViewport;

describe('BoardViewport', () => {
  it('sizes the grid area from the window, never from the grid itself', () => {
    // A wide grid grows the page; if the area followed the grid, each
    // layout would feed the next and narrow screens would never settle.
    const size = fakeWindowSize();
    try {
      setup(demoModel);
      size.resize({ width: 390 });
      const grid = screen.getByRole('grid');
      const rung = grid.dataset.rung;
      expect(rung).toBe('0');
      const area = grid.parentElement?.parentElement;
      if (!area) throw new Error('grid area not found');
      Object.defineProperty(area, 'clientWidth', {
        configurable: true,
        value: 3000,
      });
      size.resize({});
      expect(screen.getByRole('grid').dataset.rung).toBe(rung);
    } finally {
      size.restore();
    }
  });

  it.each([
    ['keeps its size on a touch device', true, false],
    ['re-lays out on a desktop', false, true],
  ])(
    'when only the window height changes, the board %s',
    (_, coarse, changes) => {
      const media = fakeMediaQueries(
        (q) => coarse && q === '(pointer: coarse)',
      );
      const size = fakeWindowSize();
      try {
        setup(demoModel);
        // Tall enough for the richest rung, then too short for it.
        size.resize({ height: 1400 });
        const rows = () => screen.getByRole('grid').style.gridTemplateRows;
        const before = rows();
        // The address bar shows again: the window is shorter.
        size.resize({ height: 400 });
        expect(rows() !== before).toBe(changes);
      } finally {
        media.restore();
        size.restore();
      }
    },
  );

  it('fits the board across the width it lays out for, group gutters included', () => {
    setup(demoModel);
    const grid = screen.getByRole('grid');
    const cols = grid.style.gridTemplateColumns.split(' ').map(parseFloat);
    const gap = parseFloat(grid.style.gap);
    const width = cols.reduce((a, b) => a + b, 0) + gap * (cols.length - 1);
    // Row names, six stages, and a gutter either side of the Preview group.
    expect(cols).toHaveLength(1 + 6 + 2);
    // Before measuring (and in tests) the viewport assumes 1280 px; the
    // columns are whole px, so the board falls short by under one a stage.
    expect(width).toBeLessThanOrEqual(1280);
    expect(width).toBeGreaterThan(1280 - 6);
  });

  it('zooms in with the button and saves the zoom with the board size', () => {
    const stores = setup();
    const field = screen.getByLabelText('Zoom');
    expect(field).toHaveValue('100%');
    expect(screen.getByRole('button', { name: 'Zoom to 100%' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(stores.preferences.getView('demo')).toMatchObject({
      zoom: 1.1,
      boardSize: '19x6',
    });
    expect(field).toHaveValue('110%');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom to 100%' }));
    expect(field).toHaveValue('100%');
  });

  it('applies a typed zoom, snapped and clamped', () => {
    const stores = setup();
    const field = screen.getByLabelText('Zoom');
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '137' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(stores.preferences.getView('demo').zoom).toBe(1.4);
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '5' } });
    fireEvent.blur(field);
    expect(stores.preferences.getView('demo').zoom).toBe(0.5);
  });

  it('zooms with + and returns to 100% with 0, leaving Ctrl+ to the browser', () => {
    const stores = setup();
    const board = screen.getByLabelText(/Board: plus and minus zoom/);
    fireEvent.keyDown(board, { key: '+' });
    fireEvent.keyDown(board, { key: '+', ctrlKey: true });
    expect(stores.preferences.getView('demo').zoom).toBe(1.1);
    fireEvent.keyDown(board, { key: '0' });
    expect(stores.preferences.getView('demo').zoom).toBe(1);
  });

  it('saves the density', () => {
    const stores = setup();
    fireEvent.click(screen.getByRole('radio', { name: 'comfortable' }));
    expect(stores.preferences.getView('demo').density).toBe('comfortable');
    expect(screen.getByRole('radio', { name: 'comfortable' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('pans on a zoomed drag without opening the cell it started on', () => {
    setup(demoModel);
    // Zoom to the top of the range: magnified, so the board overflows.
    const field = screen.getByLabelText('Zoom');
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '9999' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    const cell = screen.getAllByRole('link', { name: /Passed, dev/ })[0];
    const drag = { pointerId: 1, pointerType: 'touch' };
    fireEvent.pointerDown(cell, { ...drag, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(cell, { ...drag, clientX: 150, clientY: 160 });
    fireEvent.pointerUp(cell, drag);
    fireEvent.click(cell);
    expect(screen.queryByRole('dialog')).toBeNull();

    // A plain tap still opens the sheet.
    fireEvent.pointerDown(cell, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 10,
      clientY: 10,
      timeStamp: 10_000,
    });
    fireEvent.pointerUp(cell, { pointerId: 2, pointerType: 'touch' });
    fireEvent.click(cell);
    expect(screen.getByRole('dialog', { name: / · / })).toBeInTheDocument();
  });
});
