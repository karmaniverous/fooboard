/**
 * Smoke test for the app shell: each route renders inside the shared
 * header and footer.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { site } from '@/lib/site';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import App from './App';

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
  it.each([
    ['/', 'No dashboards yet'],
    ['/demo', 'Acme platform (demo)'],
    ['/spike/amplify', 'Amplify browser spike'],
    ['/spike/github', 'GitHub browser spike'],
  ])('renders %s inside the shell', (path, heading) => {
    renderAt(path);
    expect(screen.getByText(site.name)).toBeInTheDocument();
    expect(screen.getByText(heading)).toBeInTheDocument();
    expect(screen.getByText('Report an issue')).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });
});
