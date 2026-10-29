/**
 * For first-run tests (spec.md §3.9): the app's routes for the home page,
 * the first run's steps and a board, over in-memory stores, at a starting
 * path, with the router's state shown (`LocationState`).
 *
 * @module
 */
import { act, render } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AppNavProvider } from '@/components/AppNavProvider';
import { appQueryEnv } from '@/engine/appEnv';
import { FirstRunPage } from '@/firstRun/FirstRunPage';
import { FIRST_RUN_PATH, FIRST_RUN_STEP_ROUTE } from '@/firstRun/paths';
import { DashboardPage } from '@/pages/DashboardPage';
import { Home } from '@/pages/Home';
import { DASHBOARD_ROUTE, HOME_PATH } from '@/pages/paths';
import { type AppStores, createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { LocationState } from './LocationState';

/** The app's routes at `entry` over `stores` (fresh by default); waits
 * for the persisted cache, so pages render at once. */
export async function renderFirstRun(
  entry: string | { pathname: string; state: unknown } = HOME_PATH,
  stores: AppStores = createAppStores(memoryStorage()),
): Promise<AppStores> {
  await appQueryEnv(stores).restored;
  await act(async () => {
    await Promise.resolve();
    render(
      <StoresContext value={stores}>
        <MemoryRouter initialEntries={[entry]}>
          <AppNavProvider>
            <LocationState />
            <Suspense fallback={<p>Loading</p>}>
              <Routes>
                <Route path={HOME_PATH} element={<Home />} />
                <Route path={FIRST_RUN_PATH} element={<FirstRunPage />} />
                <Route path={FIRST_RUN_STEP_ROUTE} element={<FirstRunPage />} />
                <Route path={DASHBOARD_ROUTE} element={<DashboardPage />} />
              </Routes>
            </Suspense>
          </AppNavProvider>
        </MemoryRouter>
      </StoresContext>,
    );
  });
  return stores;
}
