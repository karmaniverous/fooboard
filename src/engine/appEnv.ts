/**
 * The app's query environment (spec.md §3.1, §3.4, Decision 2): one per
 * app, created with the stores on first use and outliving every board, so
 * the cache survives navigation, edits and credential changes. Its client
 * listens for focus and reconnects while a `QueryProvider` shows it. Its
 * providers read the credential store.
 *
 * The cache is persisted (Decisions 8, 27, 28): restored from IndexedDB
 * when the environment is created (boards wait for `restored`), and
 * written by the one tab holding the persisting lock, keeping only a
 * board's reads made with a credential's remembered secret. When a
 * credential's data must go (a replaced or forgotten secret, unticked
 * *Remember*, a removed credential or dashboard), its queries and budget
 * are removed here and in every other open tab (Decision 38), so the
 * persisting tab's next write leaves them out. A removal heard while the
 * cache is being restored is applied again once it is, before any board
 * shows it, so the restore can't bring the removed data back.
 *
 * @module
 */
import { CURRENT_SCHEMA_VERSION } from '@/domain/config/root';
import { getOrCreate } from '@/lib/memo';
import { keepsQuery } from '@/persist/keeps';
import { CACHE_GC_TIME_MS, persistQueryCache } from '@/persist/persistence';
import { createQueryEnv, type QueryEnv } from '@/query/client';
import type { AppStores } from '@/storage';

import { credentialProviders } from './credentialProviders';

/** A new app version or data model discards the persisted cache. */
const CACHE_BUSTER = `${__APP_VERSION__}+${String(CURRENT_SCHEMA_VERSION)}`;

/** The app's environment, and when its persisted cache is restored. */
export interface AppQueryEnv extends QueryEnv {
  restored: Promise<void>;
  /** Has `restored` settled? (A page renders at once if so.) */
  isRestored(): boolean;
}

const envs = new WeakMap<AppStores, AppQueryEnv>();

function createAppQueryEnv(stores: AppStores): AppQueryEnv {
  const { credentials, tabs } = stores;
  const env = createQueryEnv({
    providers: (hooks) => credentialProviders(credentials, hooks),
    gcTime: CACHE_GC_TIME_MS,
  });
  const persistence = persistQueryCache({
    client: env.client,
    storage: stores.cache,
    buster: CACHE_BUSTER,
    keeps: keepsQuery((id) => credentials.rememberedFingerprint(id)),
    readWith: env.readWith,
    locks: stores.locks,
  });
  let done = false;
  /** Credentials removed while the restore was under way. */
  const removedEarly = new Set<string>();
  const remove = (ids: readonly string[]): void => {
    env.removeCredentials(ids);
    if (!done) for (const id of ids) removedEarly.add(id);
  };
  credentials.subscribe((id, dropsData) => {
    if (!dropsData) return;
    remove([id]);
    tabs.post({ type: 'remove', credentialIds: [id] });
  });
  tabs.subscribe((message) => {
    if (message.type === 'remove') remove(message.credentialIds);
  });
  const restored = persistence.restored.then(() => {
    env.removeCredentials([...removedEarly]);
    removedEarly.clear();
    done = true;
  });
  return { ...env, restored, isRestored: () => done };
}

/** The query environment of the app owning `stores`. */
export function appQueryEnv(stores: AppStores): AppQueryEnv {
  return getOrCreate(envs, stores, () => createAppQueryEnv(stores));
}
