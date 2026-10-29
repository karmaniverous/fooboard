/**
 * Render the app shell for share and import tests: stores on an in-memory
 * device, a router whose path is shown (`where`), and the navigation
 * dialogs, opened by a share link when one is given. Also builds share
 * links and payloads from envelopes, and finds the import dialog, its
 * checkboxes and its *Import* button.
 *
 * @module
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppNavProvider } from '@/components/AppNavProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { DEMO_PATH } from '@/pages/paths';
import type { ShareEnvelope } from '@/share/envelope';
import { type LinkPayload, shareLink } from '@/share/link';
import { type AppStores, createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { RouterProbe } from './RouterProbe';

/** The path the router is at. */
export const where = (): string | null =>
  screen.getByTestId('where').textContent;

/** Render the shell (and `ui`), opened by `link` if given. */
export function renderImport(
  link: LinkPayload | null = null,
  stores: AppStores = createAppStores(memoryStorage()),
  ui: React.ReactNode = null,
): AppStores {
  render(
    <StoresContext value={stores}>
      <MemoryRouter initialEntries={[DEMO_PATH]}>
        <ThemeProvider>
          <AppNavProvider link={link}>
            <RouterProbe />
            {ui}
          </AppNavProvider>
        </ThemeProvider>
      </MemoryRouter>
    </StoresContext>,
  );
  return stores;
}

/** The payload a share link opened with `envelope` (or raw `text`). */
export const payloadOf = (envelope: ShareEnvelope | string): LinkPayload => ({
  kind: 'text',
  text: typeof envelope === 'string' ? envelope : JSON.stringify(envelope),
});

/** The fragment of `envelope`'s share link. */
export const fragmentOf = (envelope: ShareEnvelope): string =>
  new URL(shareLink(envelope, 'https://fooboard.dev')).hash;

/** The saved dashboards' ids. */
export const savedIds = (stores: AppStores): string[] => {
  const loaded = stores.config.load();
  return loaded.kind === 'ok' ? loaded.root.dashboards.map((d) => d.id) : [];
};

/** The open import dialog. */
export const dialog = (): HTMLElement =>
  screen.getByRole('dialog', { name: 'Import dashboards' });

/** The import dialog's checkbox named `name`. */
export const box = (name: string): HTMLElement =>
  within(dialog()).getByRole('checkbox', { name });

/** Click the import dialog's *Import* and let its planning settle. */
export async function importNow(): Promise<void> {
  await act(async () => {
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Import' }));
    await Promise.resolve();
  });
}
