/**
 * Smoke test for the app shell: each route renders inside the shared
 * header and footer (board pages once they have loaded); any other
 * address, the removed spike pages included, shows *Page not found* with a
 * working link home (spec.md §2.16, Scope item 6, row P7).
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it } from 'vitest';

import { site } from '@/lib/site';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import App from './App';

/** Long enough for the lazily loaded pages to load on a cold, busy test
 * run (coverage instrumentation included). */
const PAGE_LOAD_MS = 60_000;

// Load the lazy pages once up front, so each route renders them at once.
beforeAll(async () => {
  await Promise.all([
    import('@/pages/DashboardPage'),
    import('@/pages/DemoPage'),
  ]);
}, PAGE_LOAD_MS);

function renderAt(path: string): void {
  render(
    <StoresContext value={createAppStores(memoryStorage())}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </StoresContext>,
  );
}

describe('App', () => {
  it.each(['/spike/amplify', '/spike/github', '/x/y'])(
    'shows Page not found at %s, linking home',
    async (path) => {
      renderAt(path);
      const heading = await screen.findByRole('heading', {
        name: 'Page not found',
      });
      // Inside the shell: in its main region, above its footer.
      expect(screen.getByRole('main')).toContainElement(heading);
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
      expect(screen.queryByText(/browser spike/i)).toBeNull();
      expect(
        screen.getByText("There's nothing at this address."),
      ).toBeInTheDocument();
      const home = screen.getByRole('link', {
        name: 'Back to your dashboards',
      });
      expect(home).toHaveAttribute('href', '/');
      fireEvent.click(home);
      expect(await screen.findByText('No dashboards yet')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Page not found' }),
      ).toBeNull();
    },
  );

  it.each([
    ['/', 'No dashboards yet'],
    ['/demo', 'Acme platform (demo)'],
    ['/d/missing', 'Dashboard not found'],
  ])('renders %s inside the shell', async (path, heading) => {
    renderAt(path);
    // Hidden measuring copies (aria-hidden) are not part of the page.
    expect(
      await screen.findByText(
        heading,
        { ignore: '[aria-hidden="true"] *, script, style' },
        { timeout: PAGE_LOAD_MS },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(site.name, { ignore: '[aria-hidden="true"] *' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Report an issue' })[0],
    ).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
