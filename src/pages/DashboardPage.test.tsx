/**
 * Tests for a saved dashboard's page: it renders the saved board, asks
 * for a credential when it has none, and saves what the credentials panel
 * changes.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { DashboardPage } from './DashboardPage';

describe('DashboardPage', () => {
  it('shows the saved board and saves a credential added from it', () => {
    const stores = createAppStores(memoryStorage());
    stores.config.saveDashboard(
      DashboardSchema.parse({ id: 'mine', name: 'My board' }),
    );
    render(
      <StoresContext value={stores}>
        <MemoryRouter initialEntries={['/d/mine']}>
          <Routes>
            <Route path="/d/:id" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>
      </StoresContext>,
    );
    expect(
      screen.getByRole('heading', { name: 'My board' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add a credential' }));
    expect(
      screen.getByRole('dialog', { name: 'Credentials' }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Token'), {
      target: { value: 'github_pat_1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    const loaded = stores.config.load();
    expect(
      loaded.kind === 'ok' && loaded.root.dashboards[0]?.credentials,
    ).toEqual([
      expect.objectContaining({ kind: 'github', label: 'GitHub token' }),
    ]);
  });
});
