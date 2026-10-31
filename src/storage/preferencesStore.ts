/**
 * Device-preferences store (spec.md C-13, C-14, C-20): per-dashboard view
 * settings on this device (zoom, density), the theme, and the last
 * version whose release notes were seen. Never exported or shared. Unlike the
 * configuration, these are disposable: unreadable data falls back to the
 * defaults.
 *
 * @module
 */
import { omit } from 'radash';

import {
  CURRENT_DEVICE_PREFERENCES_VERSION,
  type DashboardViewPreferences,
  DashboardViewPreferencesSchema,
  type DevicePreferences,
  migrateDevicePreferences,
  type ThemeChoice,
} from '@/domain/config/devicePreferences';

import { KEY_PREFIX, type KeyValueStore, readJson } from './keyValue';

/** The storage key holding every device preference. */
export const DEVICE_PREFERENCES_KEY = `${KEY_PREFIX}device`;

export interface PreferencesStore {
  /** A dashboard's view settings, defaults filled in. */
  getView(dashboardId: string): DashboardViewPreferences;
  /** Merge `changes` into a dashboard's view settings and save. */
  setView(
    dashboardId: string,
    changes: Partial<DashboardViewPreferences>,
  ): DashboardViewPreferences;
  /** Drop a dashboard's settings (e.g. when the dashboard is deleted). */
  forget(dashboardId: string): void;
  /** The theme choice on this device (System if never chosen). */
  getTheme(): ThemeChoice;
  /** Save the theme choice on this device. */
  setTheme(theme: ThemeChoice): void;
  /** The last version whose release notes this browser has seen. */
  getLastSeenVersion(): string | undefined;
  /** Record that the release notes were seen up to `version`. */
  setLastSeenVersion(version: string): void;
}

export function createPreferencesStore(store: KeyValueStore): PreferencesStore {
  const load = (): DevicePreferences => {
    let raw: unknown;
    try {
      raw = readJson(store, DEVICE_PREFERENCES_KEY);
    } catch {
      raw = undefined;
    }
    return (
      migrateDevicePreferences(raw) ?? {
        schemaVersion: CURRENT_DEVICE_PREFERENCES_VERSION,
        theme: 'system',
        dashboards: {},
      }
    );
  };
  // View settings are disposable: if storage refuses the write (quota,
  // revoked access), keep working with the in-memory value.
  const save = (prefs: DevicePreferences): void => {
    try {
      store.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(prefs));
    } catch {
      // best effort
    }
  };
  const viewOf = (prefs: DevicePreferences, id: string) =>
    DashboardViewPreferencesSchema.parse(prefs.dashboards[id] ?? {});

  return {
    getView: (id) => viewOf(load(), id),
    setView: (id, changes) => {
      const prefs = load();
      const view = DashboardViewPreferencesSchema.parse({
        ...viewOf(prefs, id),
        ...changes,
      });
      save({ ...prefs, dashboards: { ...prefs.dashboards, [id]: view } });
      return view;
    },
    forget: (id) => {
      const prefs = load();
      save({ ...prefs, dashboards: omit(prefs.dashboards, [id]) });
    },
    getTheme: () => load().theme,
    setTheme: (theme) => {
      save({ ...load(), theme });
    },
    getLastSeenVersion: () => load().lastSeenVersion,
    setLastSeenVersion: (lastSeenVersion) => {
      save({ ...load(), lastSeenVersion });
    },
  };
}
