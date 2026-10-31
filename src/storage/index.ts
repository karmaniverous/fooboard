/**
 * The app's local stores (spec.md C-1, C-4, C-5, C-13, §3.4), built over
 * browser local storage, with the persisted query cache's storage, the
 * channel to the other open tabs and *Reset*. When the browser blocks
 * local storage (privacy settings, some private modes), the stores run in
 * memory for this tab and report it, so the app (and the demo) still
 * loads.
 *
 * @module
 */
import {
  type CacheStorage,
  cacheStorage,
  idbCacheStore,
  memoryCacheStore,
} from '@/persist/cacheStorage';
import { type Locks, withPersistLock } from '@/persist/persistLock';
import {
  broadcastTabChannel,
  silentTabChannel,
  type TabChannel,
} from '@/persist/tabChannel';

import { type ConfigStore, createConfigStore } from './configStore';
import { createCredentialStore, type CredentialStore } from './credentialStore';
import {
  clearAppData,
  KEY_PREFIX,
  type KeyValueStore,
  memoryStorage,
  webStorage,
} from './keyValue';
import {
  createPreferencesStore,
  type PreferencesStore,
} from './preferencesStore';
import { createSavedBudgets, type SavedBudgets } from './savedBudgets';

/** What the stores reach beyond local storage. */
export interface StoreIo {
  /** The persisted query cache's storage (IndexedDB). */
  cache: CacheStorage;
  /** Removals and Reset, to and from the other open tabs (Decision 38). */
  tabs: TabChannel;
  /** Web Locks, for the one tab that persists the cache (Decision 28). */
  locks: Locks | undefined;
  /** Reload the page (after a Reset). */
  reload(): void;
}

export interface AppStores extends Omit<StoreIo, 'reload'> {
  config: ConfigStore;
  preferences: PreferencesStore;
  credentials: CredentialStore;
  /** Each GitHub credential's last battery reading (Decision 109). */
  budgets: SavedBudgets;
  /** False when browser storage is unavailable: nothing outlives the tab. */
  persistent: boolean;
  /** *Reset* (C-4, §3.9): in every open tab, every fooboard key, every
   * session secret and the persisted cache; then each tab reloads. Every
   * tab first stops writing the cache (`resetting`), and the cache is
   * cleared holding the persisting lock, so no write lands after it; then
   * local storage; only then do the other tabs hear `reset` and reload,
   * so none reloads to the old configuration. Rejects, and no tab
   * reloads, if either can't be cleared (the cache first: losing it alone
   * costs nothing). The UI confirms first. */
  reset(): Promise<void>;
}

/** Browser local storage if it can be read and written, else memory. */
export function deviceStorage(getStorage: () => Storage = () => localStorage): {
  store: KeyValueStore;
  persistent: boolean;
} {
  try {
    const storage = getStorage(); // throws SecurityError when blocked
    const probe = `${KEY_PREFIX}probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return { store: webStorage(storage), persistent: true };
  } catch {
    return { store: memoryStorage(), persistent: false };
  }
}

/** The browser's: IndexedDB, BroadcastChannel, Web Locks, reload. */
function browserIo(): StoreIo {
  return {
    cache: cacheStorage(idbCacheStore()),
    tabs: broadcastTabChannel(),
    locks: 'locks' in navigator ? navigator.locks : undefined,
    reload: () => {
      window.location.reload();
    },
  };
}

/** One tab in memory: no other tabs, no locks, nothing reloads. */
function memoryIo(): StoreIo {
  return {
    cache: cacheStorage(memoryCacheStore()),
    tabs: silentTabChannel(),
    locks: undefined,
    reload: () => undefined,
  };
}

/** Build the stores; defaults to the browser's storage where available.
 * Over a given `device` (tests), the rest is in memory unless `io` says
 * otherwise. */
export function createAppStores(
  device?: KeyValueStore,
  io: Partial<StoreIo> = {},
): AppStores {
  const { store, persistent } = device
    ? { store: device, persistent: true }
    : deviceStorage();
  const { cache, tabs, locks, reload } = {
    ...(device ? memoryIo() : browserIo()),
    ...io,
  };
  const credentials = createCredentialStore(store);
  // Another tab's Reset: stop writing, so it can clear the cache; once it
  // has cleared the shared storage, drop the session secrets and reload.
  tabs.subscribe((message) => {
    if (message.type === 'resetting') cache.stop();
    if (message.type !== 'reset') return;
    credentials.clearSession();
    reload();
  });
  return {
    config: createConfigStore(store),
    preferences: createPreferencesStore(store),
    credentials,
    budgets: createSavedBudgets(store),
    persistent,
    cache,
    tabs,
    locks,
    reset: async () => {
      cache.stop();
      tabs.post({ type: 'resetting' });
      await withPersistLock(locks, () => cache.clear());
      clearAppData(store);
      credentials.clearSession();
      tabs.post({ type: 'reset' });
      reload();
    },
  };
}
