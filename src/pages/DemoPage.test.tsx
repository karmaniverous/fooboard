/**
 * Tests for the demo page's query environment lifecycle (spec.md C-23,
 * A§3.1): the page owns its environment, which listens for focus and
 * reconnects only while the page is shown. Visiting and leaving the
 * demo, again and again under StrictMode, leaves no listener behind.
 *
 * @module
 */
import { focusManager, onlineManager } from '@tanstack/query-core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { choose } from '@/test/choose';

import { DemoPage } from './DemoPage';

/** Visits to make: more than one, so a leak would pile up. */
const VISITS = 3;

/** Whether anything still listens for focus or reconnects. */
const listening = (): boolean[] => [
  focusManager.hasListeners(),
  onlineManager.hasListeners(),
];

/** Keys the stores hold, but for the board's view (zoom, row height),
 * which the demo does save per device. */
const stored = (store: ReturnType<typeof memoryStorage>) =>
  store.keys().filter((k) => !k.includes('view'));

describe('DemoPage', () => {
  it('holds settings edits in memory for the visit only, saving nothing', async () => {
    const store = memoryStorage();
    const stores = createAppStores(store);
    const before = stored(store);
    const visit = () =>
      render(
        <StoresContext value={stores}>
          <DemoPage />
        </StoresContext>,
      );
    const first = visit();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Settings for row api-core' }),
    );
    const dialog = await screen.findByRole('dialog');
    // No dashboard editor in the demo yet (N3b): no way out to one.
    expect(
      within(dialog).queryByRole('button', {
        name: 'Open in dashboard settings',
      }),
    ).not.toBeInTheDocument();
    choose(
      within(dialog).getByRole('combobox', {
        name: 'GitHub status set for Row api-core',
      }),
      'GitHub single job',
    );
    // The edit took: the popup shows it set here.
    expect(
      within(dialog).getByRole('button', {
        name: 'Reset to inherited: GitHub status set for Row api-core',
      }),
    ).toBeInTheDocument();
    expect(stored(store)).toEqual(before);
    expect(
      demoDashboard.rows.find((r) => r.id === 'api-core')?.settings,
    ).not.toHaveProperty('statusSet');
    first.unmount();

    // A new visit starts from the demo as shipped.
    visit();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Settings for row api-core' }),
    );
    expect(
      within(await screen.findByRole('dialog')).queryByRole('button', {
        name: /^Reset to inherited/,
      }),
    ).not.toBeInTheDocument();
  });

  it('lets go of focus and reconnect listeners when left, every visit', async () => {
    const stores = createAppStores(memoryStorage());
    expect(listening()).toEqual([false, false]);
    for (let visit = 0; visit < VISITS; visit += 1) {
      const view = render(
        <StrictMode>
          <StoresContext value={stores}>
            <DemoPage />
          </StoresContext>
        </StrictMode>,
      );
      expect(await screen.findByRole('heading', { level: 1 })).toBeVisible();
      expect(listening()).toEqual([true, true]);
      view.unmount();
      expect(listening()).toEqual([false, false]);
    }
  });
});
