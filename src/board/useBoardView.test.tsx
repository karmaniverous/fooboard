/**
 * Tests for useBoardView: a size change resets zoom to Fit and keeps row
 * height; switching dashboards loads that dashboard's own settings and
 * leaves the previous one's saved settings alone.
 *
 * @module
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { useBoardView } from './useBoardView';

const setup = () => {
  const stores = createAppStores(memoryStorage());
  stores.preferences.setView('b', {
    zoom: 3,
    rowHeight: 'compact',
    boardSize: '2x2',
  });
  const hook = renderHook(
    ({ id, rows }: { id: string; rows: number }) => useBoardView(id, rows, 2),
    {
      initialProps: { id: 'a', rows: 2 },
      wrapper: ({ children }) => (
        <StoresContext value={stores}>{children}</StoresContext>
      ),
    },
  );
  return { stores, hook };
};

describe('useBoardView', () => {
  it('resets zoom to Fit when the board size changes, keeping row height', () => {
    const { hook } = setup();
    act(() => {
      hook.result.current.setZoom(2);
      hook.result.current.setRowHeight('full');
    });
    hook.rerender({ id: 'a', rows: 3 });
    expect(hook.result.current.zoom).toBe(1);
    expect(hook.result.current.rowHeight).toBe('full');
  });

  it("loads the new dashboard's settings without touching the old one's", () => {
    const { stores, hook } = setup();
    act(() => {
      hook.result.current.setZoom(2);
    });
    hook.rerender({ id: 'b', rows: 2 });
    expect(hook.result.current.zoom).toBe(3);
    expect(stores.preferences.getView('a').zoom).toBe(2);
  });
});
