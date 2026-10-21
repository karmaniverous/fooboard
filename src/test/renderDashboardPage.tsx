/**
 * Renders a saved dashboard's page at `/d/<id>` with in-memory stores,
 * the dashboard saved first and a stand-in home page, for page-level
 * tests.
 *
 * @module
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { z } from 'zod';

import { DashboardSchema } from '@/domain/config/dashboard';
import { DashboardPage } from '@/pages/DashboardPage';
import { type AppStores, createAppStores } from '@/storage';
import { type KeyValueStore, memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

/** What stands in for the home page, so leaving the board shows. */
export const HOME_TEXT = 'home';

/** The page for `dashboard`, saved in fresh stores over `device`;
 * returns the stores. */
export function renderDashboardPage(
  dashboard: z.input<typeof DashboardSchema>,
  device: KeyValueStore = memoryStorage(),
): AppStores {
  const stores = createAppStores(device);
  const saved = DashboardSchema.parse(dashboard);
  stores.config.saveDashboard(saved);
  render(
    <StoresContext value={stores}>
      <MemoryRouter initialEntries={[`/d/${saved.id}`]}>
        <Routes>
          <Route path="/" element={<p>{HOME_TEXT}</p>} />
          <Route path="/d/:id" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </StoresContext>,
  );
  return stores;
}
