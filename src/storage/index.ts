/**
 * The app's local stores (spec.md C-1, C-4, C-5, C-13), built over browser
 * local storage, plus *Reset*.
 *
 * @module
 */
import { type ConfigStore, createConfigStore } from './configStore';
import { createCredentialStore, type CredentialStore } from './credentialStore';
import { clearAppData, type KeyValueStore, webStorage } from './keyValue';
import {
  createPreferencesStore,
  type PreferencesStore,
} from './preferencesStore';

export interface AppStores {
  config: ConfigStore;
  preferences: PreferencesStore;
  credentials: CredentialStore;
  /** *Reset* (C-4): every fooboard key and every session secret. The UI
   * confirms first. */
  reset(): void;
}

/** Build the stores; defaults to `localStorage`. */
export function createAppStores(
  device: KeyValueStore = webStorage(localStorage),
): AppStores {
  const credentials = createCredentialStore(device);
  return {
    config: createConfigStore(device),
    preferences: createPreferencesStore(device),
    credentials,
    reset: () => {
      clearAppData(device);
      credentials.clearSession();
    },
  };
}
