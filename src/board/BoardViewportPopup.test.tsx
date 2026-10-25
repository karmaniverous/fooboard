/**
 * Tests for the board's viewport with its settings popup (spec.md §3.11):
 * an open popup counts as interaction, so polled changes wait to reach
 * the layout while it is open; and keys pressed in the popup never reach
 * the board's zoom keys (the popup is rendered beside the viewport).
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { type BoardModel } from '@/engine';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { fullModel } from '@/test/boardModel';

import { BoardViewport } from './BoardViewport';
import { SettingsPopupProvider } from './SettingsPopup';
import { useBoardView } from './useBoardView';

/** The viewport's interaction test, as it hands it to the stable model. */
const seen = vi.hoisted(() => ({
  isInteracting: (): boolean => false,
}));
vi.mock('./useStableModel', () => ({
  useStableModel: (
    model: BoardModel,
    _: string,
    isInteracting: () => boolean,
  ) => {
    seen.isInteracting = isInteracting;
    return model;
  },
}));

let model: BoardModel;
beforeAll(async () => {
  model = await fullModel(demoDashboard);
});

function Harness(): React.JSX.Element {
  const view = useBoardView('demo', 19, 6);
  return (
    <SettingsPopupProvider dashboard={demoDashboard} onChange={vi.fn()}>
      <BoardViewport
        dashboard={demoDashboard}
        model={model}
        now={0}
        view={view}
      />
    </SettingsPopupProvider>
  );
}

const setup = () => {
  render(
    <StoresContext value={createAppStores(memoryStorage())}>
      <Harness />
    </StoresContext>,
  );
};

describe('BoardViewport with the settings popup', () => {
  it('counts an open popup as interaction, and its closing as the end of it', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      setup();
      // Past the interaction window from loading.
      vi.setSystemTime(Date.now() + 60_000);
      expect(seen.isInteracting()).toBe(false);
      fireEvent.click(
        screen.getByRole('button', { name: 'Settings for row api-core' }),
      );
      expect(seen.isInteracting()).toBe(true);
      vi.setSystemTime(Date.now() + 60_000);
      expect(seen.isInteracting()).toBe(true);
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      vi.setSystemTime(Date.now() + 60_000);
      expect(seen.isInteracting()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the grid area when a modal hides the page scrollbar', () => {
    const root = document.documentElement;
    const width = Object.getOwnPropertyDescriptor(root, 'clientWidth');
    const setWidth = (value: number) => {
      Object.defineProperty(root, 'clientWidth', {
        configurable: true,
        value,
      });
    };
    try {
      setWidth(390);
      setup();
      fireEvent(window, new Event('resize'));
      const rung = screen.getByRole('grid').dataset.rung;
      // The scroll lock hides a scrollbar: the window reads wider, by the
      // width the lock records.
      setWidth(3000);
      document.body.style.setProperty(
        '--removed-body-scroll-bar-size',
        '2610px',
      );
      fireEvent(window, new Event('resize'));
      expect(screen.getByRole('grid').dataset.rung).toBe(rung);
      document.body.style.removeProperty('--removed-body-scroll-bar-size');
      fireEvent(window, new Event('resize'));
      expect(screen.getByRole('grid').dataset.rung).not.toBe(rung);
    } finally {
      document.body.style.removeProperty('--removed-body-scroll-bar-size');
      if (width) Object.defineProperty(root, 'clientWidth', width);
      else Reflect.deleteProperty(root, 'clientWidth');
    }
  });

  it('keeps keys pressed in the popup from zooming the board', async () => {
    setup();
    const grid = screen.getByRole('grid');
    const size = grid.style.fontSize;
    fireEvent.click(
      screen.getByRole('button', { name: 'Settings for row api-core' }),
    );
    const dialog = await screen.findByRole('dialog');
    const field = within(dialog).getByRole('combobox', {
      name: 'GitHub token for Row api-core',
    });
    for (const key of ['+', '-', '0', '=']) fireEvent.keyDown(field, { key });
    expect(screen.getByRole('grid', { hidden: true }).style.fontSize).toBe(
      size,
    );
  });
});
