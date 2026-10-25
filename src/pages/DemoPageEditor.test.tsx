/**
 * The demo's dashboard editor (spec.md §3.14 *Board and edits*, §3.11
 * *Demo*): its settings popup opens the editor at the place like any
 * board's; the editor's pickers list the simulated account, repos and
 * apps the board doesn't show included; every edit stays in memory for
 * the visit, saving nothing; and it offers no duplicate or delete.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { DEMO_RENDER_TIMEOUT_MS } from '@/test/demoRender';

import { DemoPage } from './DemoPage';

function renderDemo(store = memoryStorage()) {
  const stores = createAppStores(store);
  const view = render(
    <MemoryRouter initialEntries={['/demo']}>
      <StoresContext value={stores}>
        <Suspense fallback="Loading">
          <DemoPage />
        </Suspense>
      </StoresContext>
    </MemoryRouter>,
  );
  return { store, view };
}

const editor = () => screen.getByRole('dialog', { name: 'Edit dashboard' });

/** Open the editor from the board's actions, on `tab`. */
async function openEditor(tab: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  // Radix tabs switch on mouse down.
  fireEvent.mouseDown(within(editor()).getByRole('tab', { name: tab }), {
    button: 0,
  });
}

describe('the demo dashboard editor', () => {
  it(
    'plays the measurement scenario when a development URL asks',
    async () => {
      window.history.pushState({}, '', '/demo?scenario=measure');
      try {
        renderDemo();
        expect(
          await screen.findByRole(
            'button',
            { name: 'Settings for row api-core' },
            { timeout: 20_000 },
          ),
        ).toBeVisible();
      } finally {
        window.history.pushState({}, '', '/');
      }
    },
    DEMO_RENDER_TIMEOUT_MS,
  );

  it(
    'opens at the row from its settings popup',
    async () => {
      renderDemo();
      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Settings for row api-gateway',
        }),
      );
      const popup = await screen.findByRole('dialog');
      fireEvent.click(
        within(popup).getByRole('button', {
          name: 'Open in dashboard settings',
        }),
      );
      const selected = within(editor())
        .getAllByRole('tab')
        .find((t) => t.getAttribute('aria-selected') === 'true');
      expect(selected?.textContent).toBe('Rows');
      expect(
        within(editor()).getByRole('combobox', {
          name: 'GitHub token for Row api-gateway',
        }),
      ).toBeVisible();
    },
    DEMO_RENDER_TIMEOUT_MS,
  );

  it(
    "lists the demo account's repos, those off the board included",
    async () => {
      renderDemo();
      await openEditor('Rows');
      fireEvent.click(
        within(editor()).getByRole('button', { name: 'Add a GitHub row' }),
      );
      expect(
        await within(editor()).findByRole('button', {
          name: 'acme/design-system',
        }),
      ).toBeVisible();
      expect(
        within(editor()).getByRole('button', { name: 'acme/sandbox' }),
      ).toBeVisible();
    },
    DEMO_RENDER_TIMEOUT_MS,
  );

  it(
    "lists the demo account's Amplify apps across regions, those off the board included",
    async () => {
      renderDemo();
      await openEditor('Rows');
      fireEvent.click(
        within(editor()).getByRole('button', { name: 'List Amplify apps' }),
      );
      // sandbox (off the board) in us-east-1, admin-console in us-west-2.
      expect(
        await within(editor()).findAllByText(/sandbox/, {}, { timeout: 5000 }),
      ).not.toHaveLength(0);
      expect(within(editor()).getAllByText(/admin-console/)).not.toHaveLength(
        0,
      );
      expect(within(editor()).getAllByText(/us-west-2/)).not.toHaveLength(0);
    },
    DEMO_RENDER_TIMEOUT_MS,
  );

  it(
    'sends nothing through the global fetch',
    async () => {
      const spy = vi.spyOn(globalThis, 'fetch');
      renderDemo();
      expect(await screen.findAllByRole('gridcell')).not.toHaveLength(0);
      await openEditor('Rows');
      fireEvent.click(
        within(editor()).getByRole('button', { name: 'Add a GitHub row' }),
      );
      expect(
        await within(editor()).findByRole('button', {
          name: 'acme/design-system',
        }),
      ).toBeVisible();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    },
    DEMO_RENDER_TIMEOUT_MS,
  );

  it(
    'keeps edits in memory for the visit, saving nothing, with no duplicate or delete',
    async () => {
      const { store, view } = renderDemo();
      const before = store.keys().filter((k) => !k.includes('view'));
      await openEditor('General');
      expect(
        within(editor()).queryByRole('button', { name: 'Duplicate dashboard' }),
      ).toBeNull();
      expect(
        within(editor()).queryByRole('button', { name: /^Delete/ }),
      ).toBeNull();
      const name = within(editor()).getByRole('textbox', {
        name: 'Dashboard name',
      });
      fireEvent.change(name, { target: { value: 'My demo' } });
      fireEvent.blur(name);
      expect(await screen.findAllByText('My demo')).not.toHaveLength(0);
      expect(store.keys().filter((k) => !k.includes('view'))).toEqual(before);
      view.unmount();
      renderDemo(store);
      expect(
        await screen.findAllByText('Acme platform (demo)'),
      ).not.toHaveLength(0);
      expect(screen.queryByText('My demo')).toBeNull();
    },
    DEMO_RENDER_TIMEOUT_MS,
  );
});
