/**
 * The app's query environment for a page that reads with saved
 * credentials (spec.md §3.1, §3.4): a board, or the first run's repo and
 * stage steps. The page waits (the app's Suspense) until the persisted
 * cache is restored, so it shows what was cached at once. Call it after
 * the page's other hooks: a hook after a suspending `use` changes the
 * hook order when the page resumes.
 *
 * @module
 */
import { use } from 'react';

import { type AppQueryEnv, appQueryEnv } from '@/engine/appEnv';
import { useStores } from '@/storage/storesContext';

export function useAppQueryEnv(): AppQueryEnv {
  const env = appQueryEnv(useStores());
  if (!env.isRestored()) use(env.restored);
  return env;
}
