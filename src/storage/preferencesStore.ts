/**
 * Device-preferences store (spec.md C-13): per-dashboard view settings on
 * this device (zoom, row height). Never exported or shared. Unlike the
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
  DevicePreferencesSchema,
} from '@/domain/config/devicePreferences';

import { KEY_PREFIX, type KeyValueStore, readJson } from './keyValue';

const KEY = `${KEY_PREFIX}device`;

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
}

export function createPreferencesStore(store: KeyValueStore): PreferencesStore {
  const load = (): DevicePreferences => {
    const parsed = DevicePreferencesSchema.safeParse(readJson(store, KEY));
    return parsed.success
      ? parsed.data
      : { schemaVersion: CURRENT_DEVICE_PREFERENCES_VERSION, dashboards: {} };
  };
  const save = (prefs: DevicePreferences): void => {
    store.setItem(KEY, JSON.stringify(prefs));
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
  };
}
