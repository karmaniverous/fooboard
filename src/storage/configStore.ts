/**
 * Configuration store (spec.md C-1): every dashboard, under the versioned
 * schema, in local storage. Loading migrates older versions. Stored data
 * that fails validation is never silently overwritten: the store reports
 * it and stays read-only until the user resets (C-4), so a bad release
 * can't destroy someone's boards.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import { migrate } from '@/domain/config/migrate';
import {
  type ConfigRoot,
  ConfigRootSchema,
  CURRENT_SCHEMA_VERSION,
} from '@/domain/config/root';
import { describeError } from '@/lib/errors';

import { KEY_PREFIX, type KeyValueStore, readJson } from './keyValue';

const KEY = `${KEY_PREFIX}config`;

/** What loading found. */
export type ConfigLoad =
  | { kind: 'ok'; root: ConfigRoot }
  /** Stored data exists but can't be read; nothing is written over it. */
  | { kind: 'unreadable'; reason: string };

export interface ConfigStore {
  load(): ConfigLoad;
  /** Validate and save. Throws if the stored data is unreadable. */
  save(root: ConfigRoot): void;
  /** Insert or replace one dashboard by id, keeping order. */
  saveDashboard(dashboard: Dashboard): void;
  removeDashboard(id: string): void;
}

const emptyRoot = (): ConfigRoot => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  dashboards: [],
});

export function createConfigStore(store: KeyValueStore): ConfigStore {
  const load = (): ConfigLoad => {
    if (store.getItem(KEY) === null) return { kind: 'ok', root: emptyRoot() };
    const raw = readJson(store, KEY);
    if (raw === undefined) {
      return { kind: 'unreadable', reason: 'stored configuration is not JSON' };
    }
    try {
      return { kind: 'ok', root: migrate(raw) };
    } catch (err) {
      return { kind: 'unreadable', reason: describeError(err) };
    }
  };

  const current = (): ConfigRoot => {
    const loaded = load();
    if (loaded.kind === 'unreadable') {
      throw new Error(
        `Refusing to overwrite unreadable configuration: ${loaded.reason}`,
      );
    }
    return loaded.root;
  };

  const save = (root: ConfigRoot): void => {
    current(); // throws rather than overwrite unreadable data
    store.setItem(KEY, JSON.stringify(ConfigRootSchema.parse(root)));
  };

  return {
    load,
    save,
    saveDashboard: (dashboard) => {
      const root = current();
      const index = root.dashboards.findIndex((d) => d.id === dashboard.id);
      const dashboards = [...root.dashboards];
      if (index < 0) dashboards.push(dashboard);
      else dashboards[index] = dashboard;
      save({ ...root, dashboards });
    },
    removeDashboard: (id) => {
      const root = current();
      save({ ...root, dashboards: root.dashboards.filter((d) => d.id !== id) });
    },
  };
}
