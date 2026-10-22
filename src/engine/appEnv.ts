/**
 * The app's query environment (spec.md §3.1, Decision 2): one per app,
 * created with the stores on first use and outliving every board, so the
 * cache survives navigation, edits and credential changes. Its providers
 * read the credential store.
 *
 * @module
 */
import { createQueryEnv, type QueryEnv } from '@/query/client';
import type { AppStores } from '@/storage';

import { credentialProviders } from './credentialProviders';

const envs = new WeakMap<AppStores, QueryEnv>();

/** The query environment of the app owning `stores`. */
export function appQueryEnv(stores: AppStores): QueryEnv {
  let env = envs.get(stores);
  if (!env) {
    env = createQueryEnv({
      providers: (hooks) => credentialProviders(stores.credentials, hooks),
    });
    envs.set(stores, env);
  }
  return env;
}
