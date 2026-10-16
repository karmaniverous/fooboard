/**
 * The app's local stores (spec.md C-1, C-4, C-5, C-13), built over browser
 * local storage, plus *Reset*. When the browser blocks storage (privacy
 * settings, some private modes), the stores run in memory for this tab and
 * report it, so the app (and the demo) still loads.
 *
 * @module
 */
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

export interface AppStores {
  config: ConfigStore;
  preferences: PreferencesStore;
  credentials: CredentialStore;
  /** False when browser storage is unavailable: nothing outlives the tab. */
  persistent: boolean;
  /** *Reset* (C-4): every fooboard key and every session secret. The UI
   * confirms first. */
  reset(): void;
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

/** Build the stores; defaults to browser local storage where available. */
export function createAppStores(device?: KeyValueStore): AppStores {
  const { store, persistent } = device
    ? { store: device, persistent: true }
    : deviceStorage();
  const credentials = createCredentialStore(store);
  return {
    config: createConfigStore(store),
    preferences: createPreferencesStore(store),
    credentials,
    persistent,
    reset: () => {
      clearAppData(store);
      credentials.clearSession();
    },
  };
}
