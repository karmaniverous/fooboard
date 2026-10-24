/**
 * Tests for the board viewport: zoom buttons and keys change and save the
 * zoom, 100% and `0` return to the fitted layout, and density is saved.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { type BoardModel, emptyModel } from '@/engine';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { fullModel } from '@/test/boardModel';

import { BoardViewport } from './BoardViewport';
import { useBoardView } from './useBoardView';

let demoModel: BoardModel = emptyModel();
beforeAll(async () => {
  demoModel = await fullModel(demoDashboard);
});

function Harness({
  model = emptyModel(),
}: {
  model?: BoardModel;
}): React.JSX.Element {
  const view = useBoardView('demo', 19, 6);
  return (
    <BoardViewport
      dashboard={demoDashboard}
      model={model}
      now={0}
      view={view}
    />
  );
}

const setup = (model?: BoardModel) => {
  const stores = createAppStores(memoryStorage());
  render(
    <StoresContext value={stores}>
      <Harness model={model} />
    </StoresContext>,
  );
  return stores;
};

describe('BoardViewport', () => {
  it('sizes the grid area from the window, never from the grid itself', () => {
    // A wide grid grows the page; if the area followed the grid, each
    // layout would feed the next and narrow screens would never settle.
    const root = document.documentElement;
    const width = Object.getOwnPropertyDescriptor(root, 'clientWidth');
    Object.defineProperty(root, 'clientWidth', {
      configurable: true,
      value: 390,
    });
    try {
      setup(demoModel);
      fireEvent(window, new Event('resize'));
      const grid = screen.getByRole('grid');
      const rung = grid.dataset.rung;
      expect(rung).toBe('0');
      const area = grid.parentElement?.parentElement;
      if (!area) throw new Error('grid area not found');
      Object.defineProperty(area, 'clientWidth', {
        configurable: true,
        value: 3000,
      });
      fireEvent(window, new Event('resize'));
      expect(screen.getByRole('grid').dataset.rung).toBe(rung);
    } finally {
      if (width) Object.defineProperty(root, 'clientWidth', width);
      else Reflect.deleteProperty(root, 'clientWidth');
    }
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
