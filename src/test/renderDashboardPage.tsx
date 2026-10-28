/**
 * Renders a saved dashboard's page at `/d/<id>` with in-memory stores,
 * the dashboard saved first, the (empty) persisted cache restored, and a
 * stand-in home page, for page-level tests.
 *
 * @module
 */
import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { z } from 'zod';

import { DashboardSchema } from '@/domain/config/dashboard';
import { appQueryEnv } from '@/engine/appEnv';
import { DashboardPage } from '@/pages/DashboardPage';
import { type AppStores, createAppStores } from '@/storage';
import { type KeyValueStore, memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

/** What stands in for the home page, so leaving the board shows. */
export const HOME_TEXT = 'home';

/** The routes showing dashboard `id`'s page over `stores`. */
export function dashboardPageAt(
  stores: AppStores,
  id: string,
): React.JSX.Element {
  return (
    <StoresContext value={stores}>
      <MemoryRouter initialEntries={[`/d/${id}`]}>
        <Routes>
          <Route path="/" element={<p>{HOME_TEXT}</p>} />
          <Route path="/d/:id" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </StoresContext>
  );
}

/** The page for `dashboard`, saved in fresh stores over `device`
 * (or in `stores`); returns the stores. */
export async function renderDashboardPage(
  dashboard: z.input<typeof DashboardSchema>,
  device: KeyValueStore = memoryStorage(),
  stores: AppStores = createAppStores(device),
): Promise<AppStores> {
  const saved = DashboardSchema.parse(dashboard);
  stores.config.saveDashboard(saved);
  await appQueryEnv(stores).restored;
  // Inside act: the first reads land and render before the test goes on.
  await act(async () => {
    await Promise.resolve();
    render(dashboardPageAt(stores, saved.id));
  });
  return stores;
}
