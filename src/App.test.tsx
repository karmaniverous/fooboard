/**
 * Smoke test for the app shell: each route renders inside the shared
 * header and footer (board pages once they have loaded); the removed
 * spike pages are gone.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
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
  it.each(['/spike/amplify', '/spike/github'])(
    'no longer serves the browser spike at %s',
    async (path) => {
      renderAt(path);
      expect(await screen.findByRole('contentinfo')).toBeInTheDocument();
      expect(screen.queryByText(/browser spike/i)).toBeNull();
      expect(screen.getByRole('main')).toBeEmptyDOMElement();
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
