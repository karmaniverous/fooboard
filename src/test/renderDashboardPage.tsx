/**
 * Renders a saved dashboard's page at `/d/<id>` with in-memory stores,
 * the dashboard saved first, for page-level tests.
 *
 * @module
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { z } from 'zod';

import { DashboardSchema } from '@/domain/config/dashboard';
import { DashboardPage } from '@/pages/DashboardPage';
import { type AppStores, createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

/** The page for `dashboard`, saved in fresh stores; returns the stores. */
export function renderDashboardPage(
  dashboard: z.input<typeof DashboardSchema>,
): AppStores {
  const stores = createAppStores(memoryStorage());
  const saved = DashboardSchema.parse(dashboard);
  stores.config.saveDashboard(saved);
  render(
    <StoresContext value={stores}>
      <MemoryRouter initialEntries={[`/d/${saved.id}`]}>
        <Routes>
          <Route path="/d/:id" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </StoresContext>,
  );
  return stores;
}
