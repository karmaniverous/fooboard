/**
 * A board's fixes open the dashboard editor (spec.md §2.4), shown on the
 * demo's board (`DashboardView` over the simulator): a row's problem mark
 * opens the editor at the problem, an unmapped run's *Add rule* and *Add
 * override* open it on their drafts, and closing the editor closes it.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { DEVICE_PREFERENCES_KEY } from '@/storage/preferencesStore';
import { StoresContext } from '@/storage/storesContext';
import { DEMO_RENDER_TIMEOUT_MS } from '@/test/demoRender';

import { DemoPage } from './DemoPage';

const FIND = { timeout: 30_000 };

function renderDemo(storage = memoryStorage()) {
  render(
    <MemoryRouter initialEntries={['/demo']}>
      <StoresContext value={createAppStores(storage)}>
        <DemoPage />
      </StoresContext>
    </MemoryRouter>,
  );
}

const editor = () => screen.queryByRole('dialog', { name: 'Edit dashboard' });

describe('board fixes', () => {
  it(
    "opens the editor at a row's problem, and closes it",
    async () => {
      renderDemo();
      fireEvent.click(
        await screen.findByRole(
          'button',
          { name: /problem: .*Open the editor at it$/ },
          FIND,
        ),
      );
      expect(editor()).toBeVisible();
      fireEvent.click(
        within(editor() ?? document.body).getByRole('button', {
          name: 'Close',
        }),
      );
      expect(editor()).toBeNull();
    },
    DEMO_RENDER_TIMEOUT_MS,
  );

  it.each(['Add rule', 'Add override'])(
    "opens the editor from an unmapped run's %s",
    async (fix) => {
      renderDemo();
      // Text queries: role queries over the whole board are slow in jsdom.
      const label = await screen.findByText(/^Unmapped \(\d+\)$/, {}, FIND);
      fireEvent.click(label.closest('button') ?? label);
      const panel = await screen.findByRole('dialog', {}, FIND);
      expect(editor()).toBeNull();
      fireEvent.click(within(panel).getAllByText(fix)[0]);
      expect(editor()).toBeVisible();
    },
    DEMO_RENDER_TIMEOUT_MS,
  );
  it(
    'keeps a dismissal in the demo for the visit, off the device',
    async () => {
      const storage = memoryStorage();
      renderDemo(storage);
      const label = await screen.findByText(/^Problems \(\d+\)$/, {}, FIND);
      const before = label.textContent;
      fireEvent.click(label.closest('button') ?? label);
      const panel = await screen.findByRole('dialog', {}, FIND);
      fireEvent.click(within(panel).getAllByText('Dismiss')[0]);
      // One fewer problem shown, and nothing dismissed on the device.
      expect(label.textContent).not.toBe(before);
      expect(storage.getItem(DEVICE_PREFERENCES_KEY) ?? '').not.toMatch(
        /"dismissedProblems":\["/,
      );
    },
    DEMO_RENDER_TIMEOUT_MS,
  );
});
