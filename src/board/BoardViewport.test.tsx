/**
 * Tests for the board viewport: zoom buttons and keys change and save the
 * zoom, Fit and `0` return to the whole board, and row height is saved.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { BoardViewport } from './BoardViewport';
import { useBoardView } from './useBoardView';

const empty = { cells: {}, unmapped: [], budgets: {}, refreshedAt: {} };

function Harness(): React.JSX.Element {
  const view = useBoardView('demo', 19, 6);
  return (
    <BoardViewport
      dashboard={demoDashboard}
      model={empty}
      now={0}
      view={view}
    />
  );
}

const setup = () => {
  const stores = createAppStores(memoryStorage());
  render(
    <StoresContext value={stores}>
      <Harness />
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
});
