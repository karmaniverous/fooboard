/**
 * A board's fixes open the dashboard editor (spec.md §2.4), shown on the
 * demo's board (`DashboardView` over the simulator): a row's problem mark
 * opens the editor at the problem, an unmapped run's *Add rule* and *Add
 * override* open it on their drafts, and closing the editor closes it;
 * dismissing the last unmapped entry closes its panel and focuses the
 * board's title.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { BOARD_TITLE_ID } from '@/board/BoardScreen';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { DEVICE_PREFERENCES_KEY } from '@/storage/preferencesStore';
import { StoresContext } from '@/storage/storesContext';
import { DEMO_RENDER_TIMEOUT_MS } from '@/test/demoRender';
import { WAIT } from '@/test/timeouts';

import { DemoPage } from './DemoPage';
import { DEMO_PATH } from './paths';

const FIND = WAIT;
/** Long enough for a closed panel's focus return (Radix's 0 ms timer). */
const PANEL_CLOSE_MS = 50;

function renderDemo(storage = memoryStorage()) {
  render(
    <MemoryRouter initialEntries={[DEMO_PATH]}>
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
      // Label queries: role queries over the whole board are slow in jsdom.
      const button = await screen.findByLabelText(
        /^Unmapped runs \(\d+\)$/,
        {},
        FIND,
      );
      fireEvent.click(button);
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
      const button = await screen.findByLabelText(
        /^Problems \(\d+\)$/,
        {},
        FIND,
      );
      const before = button.getAttribute('aria-label');
      fireEvent.click(button);
      const panel = await screen.findByRole('dialog', {}, FIND);
      fireEvent.click(within(panel).getAllByText('Dismiss')[0]);
      // One fewer problem shown, and nothing dismissed on the device.
      expect(button.getAttribute('aria-label')).not.toBe(before);
      expect(storage.getItem(DEVICE_PREFERENCES_KEY) ?? '').not.toMatch(
        /"dismissedProblems":\["/,
      );
    },
    DEMO_RENDER_TIMEOUT_MS,
  );

  it(
    'counts the unmapped entries shown, and hides the button at zero',
    async () => {
      renderDemo();
      const count = () => {
        const label =
          screen
            .queryByLabelText(/^Unmapped runs \(\d+\)$/)
            ?.getAttribute('aria-label') ?? '';
        return Number(/\d+/.exec(label)?.[0] ?? 0);
      };
      fireEvent.click(
        await screen.findByLabelText(/^Unmapped runs \(\d+\)$/, {}, FIND),
      );
      const panel = await screen.findByRole('dialog', {}, FIND);
      const total = count();
      expect(total).toBeGreaterThan(0);
      // Dismiss each entry left with its first preset, until none is shown.
      const counts = [total];
      for (let left = total; left > 0 && count() > 0; left -= 1) {
        fireEvent.click(within(panel).getAllByText('Dismiss…')[0]);
        fireEvent.click(within(panel).getByRole('button', { name: 'Dismiss' }));
        counts.push(count());
      }
      // Each dismissal hid at least one entry; the last left none.
      expect(counts.every((n, i) => i === 0 || n < (counts[i - 1] ?? 0))).toBe(
        true,
      );
      expect(counts.at(-1)).toBe(0);
      expect(screen.queryByLabelText(/^Unmapped runs/)).toBeNull();
      // The panel gone with its button, focus is on the board's title, and
      // stays there once the panel's own close has run.
      await act(async () => {
        await new Promise((done) => setTimeout(done, PANEL_CLOSE_MS));
      });
      expect(document.activeElement?.id).toBe(BOARD_TITLE_ID);
    },
    DEMO_RENDER_TIMEOUT_MS,
  );
});
