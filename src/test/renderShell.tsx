/**
 * Render a piece of the app shell (header, footer) with what it needs:
 * stores on an in-memory device, a router, the theme and the nav state.
 *
 * @module
 */
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppNavProvider } from '@/components/AppNavProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import type { ThemeChoice } from '@/domain/config/devicePreferences';
import { type AppStores, createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import type { Release } from '@/whatsNew/changelog';

/** Render `ui` in the shell over `stores`; `theme` is the device's
 * saved choice; What's new lists `releases` (none by default, so a test
 * doesn't depend on the bundled changelog). */
export function renderShell(
  ui: React.ReactNode,
  theme?: ThemeChoice,
  stores: AppStores = createAppStores(memoryStorage()),
  releases: readonly Release[] = [],
): AppStores {
  if (theme) stores.preferences.setTheme(theme);
  render(
    <StoresContext value={stores}>
      <MemoryRouter>
        <ThemeProvider>
          <AppNavProvider releases={releases}>{ui}</AppNavProvider>
        </ThemeProvider>
      </MemoryRouter>
    </StoresContext>,
  );
  return stores;
}
