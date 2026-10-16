/**
 * Tests for the board viewport: zoom buttons and keys change and save the
 * zoom, Fit and `0` return to the whole board, and row height is saved.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import {
  type BoardModel,
  createBoardEngine,
  demoProviders,
  emptyModel,
} from '@/engine';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { BoardViewport } from './BoardViewport';
import { useBoardView } from './useBoardView';

let demoModel: BoardModel = emptyModel();
beforeAll(async () => {
  const engine = createBoardEngine({
    dashboard: demoDashboard,
    providers: demoProviders(() => 0),
    visibility: { isHidden: () => false, onChange: () => () => undefined },
  });
  await engine.refreshAll();
  demoModel = engine.getModel();
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
  it('zooms in with the button and saves the zoom with the board size', () => {
    const stores = setup();
    expect(
      screen.getByRole('button', { name: 'Fit board to screen' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(stores.preferences.getView('demo')).toMatchObject({
      zoom: 1.25,
      boardSize: '19x6',
    });
    expect(
      screen.getByRole('button', { name: 'Fit board to screen' }),
    ).toBeEnabled();
  });

  it('zooms with + and returns to Fit with 0, leaving Ctrl+ to the browser', () => {
    const stores = setup();
    const board = screen.getByLabelText(/Board: plus and minus zoom/);
    fireEvent.keyDown(board, { key: '+' });
    fireEvent.keyDown(board, { key: '+', ctrlKey: true });
    expect(stores.preferences.getView('demo').zoom).toBe(1.25);
    fireEvent.keyDown(board, { key: '0' });
    expect(stores.preferences.getView('demo').zoom).toBe(1);
  });

  it('saves the row height', () => {
    const stores = setup();
    fireEvent.click(screen.getByRole('button', { name: 'full' }));
    expect(stores.preferences.getView('demo').rowHeight).toBe('full');
    expect(screen.getByRole('button', { name: 'full' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('pans on a zoomed drag without opening the cell it started on', () => {
    setup(demoModel);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const cell = screen.getAllByRole('link', { name: /Success, dev/ })[0];
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
    expect(
      screen.getByRole('dialog', { name: 'Cell detail' }),
    ).toBeInTheDocument();
  });
});
