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
import { StoresContext } from '@/storage/storesContext';

import { DemoPage } from './DemoPage';

/** The demo board (21 × 5 cells) takes seconds to render in jsdom. */
const DEMO_RENDER_TIMEOUT_MS = 60_000;
const FIND = { timeout: 30_000 };

function renderDemo() {
  render(
    <MemoryRouter initialEntries={['/demo']}>
      <StoresContext value={createAppStores(memoryStorage())}>
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
});
