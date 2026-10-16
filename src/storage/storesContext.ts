/**
 * React context carrying the app's local stores (spec.md C-1), so pages
 * read and write configuration, preferences and credentials without
 * reaching for `localStorage` themselves (and tests can supply memory
 * stores).
 *
 * @module
 */
import { createContext, useContext } from 'react';

import type { AppStores } from './index';

export const StoresContext = createContext<AppStores | null>(null);

/** The app's stores; throws outside `StoresContext`. */
export function useStores(): AppStores {
  const stores = useContext(StoresContext);
  if (!stores) throw new Error('useStores must be used inside StoresContext');
  return stores;
}
