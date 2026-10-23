/**
 * Tests for the demo page's query environment lifecycle (spec.md C-23,
 * A§3.1): the page owns its environment, which listens for focus and
 * reconnects only while the page is shown. Visiting and leaving the
 * demo, again and again under StrictMode, leaves no listener behind.
 *
 * @module
 */
import { focusManager, onlineManager } from '@tanstack/query-core';
import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';

import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { DemoPage } from './DemoPage';

/** Visits to make: more than one, so a leak would pile up. */
const VISITS = 3;

/** Whether anything still listens for focus or reconnects. */
const listening = (): boolean[] => [
  focusManager.hasListeners(),
  onlineManager.hasListeners(),
];

describe('DemoPage', () => {
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
