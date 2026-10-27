/**
 * The app shell shows the error screen (spec.md §3.10, Decision 25) in
 * place of the whole app when a page throws while rendering, with the
 * saved board's data nowhere in the prefilled issue.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { acmeBoard } from '@/test/acmeBoard';

import App from './App';

const TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';

vi.mock('@/pages/Home', () => ({
  Home: (): React.JSX.Element => {
    throw new Error(`Home broke reading with ${TOKEN}`);
  },
}));

describe('App', () => {
  it('shows the error screen when a page throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const stores = createAppStores(memoryStorage());
    stores.config.saveDashboard(acmeBoard);
    stores.credentials.set('gh', { kind: 'github', token: TOKEN }, true);
    render(
      <StoresContext value={stores}>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </StoresContext>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Error: Home broke reading with <token>');
    // The whole app gives way to it, header and footer included.
    expect(screen.queryByRole('banner')).toBeNull();
    const href =
      screen
        .getByRole('link', { name: 'Report an issue' })
        .getAttribute('href') ?? '';
    const issue = decodeURIComponent(href);
    expect(issue).not.toContain(TOKEN);
    for (const row of acmeBoard.rows)
      expect(issue).not.toContain(row.displayName);
    expect(issue).not.toContain(acmeBoard.name);
  });
});
