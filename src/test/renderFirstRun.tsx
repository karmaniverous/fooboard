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
import { DashboardPage } from '@/pages/DashboardPage';
import { Home } from '@/pages/Home';
import { type AppStores, createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { LocationState } from './LocationState';

/** The app's routes at `entry` over `stores` (fresh by default); waits
 * for the persisted cache, so pages render at once. */
export async function renderFirstRun(
  entry: string | { pathname: string; state: unknown } = '/',
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
                <Route path="/" element={<Home />} />
                <Route path="/new" element={<FirstRunPage />} />
                <Route path="/new/:id/:step" element={<FirstRunPage />} />
                <Route path="/d/:id" element={<DashboardPage />} />
              </Routes>
            </Suspense>
          </AppNavProvider>
        </MemoryRouter>
      </StoresContext>,
    );
  });
  return stores;
}
