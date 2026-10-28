/**
 * The board viewport over the 19 x 6 demo board, with the zoom and
 * density saved in memory, for the viewport's tests.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';

import { type BoardModel, emptyModel } from '@/engine';
import { type AppStores, createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { ViewportHarness } from './ViewportHarness';

/** Render the viewport; the stores hold its saved zoom and density. */
export function renderViewport(model: BoardModel = emptyModel()): AppStores {
  const stores = createAppStores(memoryStorage());
  render(
    <StoresContext value={stores}>
      <ViewportHarness model={model} />
    </StoresContext>,
  );
  return stores;
}

/** The board's own focusable area (its zoom keys and gestures). */
export const boardArea = (): HTMLElement =>
  screen.getByLabelText(/Board: plus and minus zoom/);
