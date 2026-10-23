/**
 * Tests for the v4 → v5 migration as stored (spec.md §3.2, data model v5):
 * a v4 configuration loads as v5 with default *requests in flight*;
 * loading writes nothing; the first save keeps the original under
 * `fooboard:config.v4`, and the backup stays until the next successful
 * save after it.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { CURRENT_SCHEMA_VERSION } from '@/domain/config/root';
import { DEFAULT_REQUESTS_IN_FLIGHT } from '@/domain/config/settings';

import { backupKey, createConfigStore } from './configStore';
import { type KeyValueStore, memoryStorage } from './keyValue';

const KEY = 'fooboard:config';
const V4 = 4;

/** A v4 dashboard: no settings. */
const v4Dashboard = {
  id: 'd',
  name: 'Ops',
  credentials: [],
  rows: [],
  stages: [],
};

/** A v4 configuration: one dashboard. */
const v4Text = JSON.stringify({ schemaVersion: V4, dashboards: [v4Dashboard] });

/** Memory storage holding the v4 text; writes to `KEY` fail on demand. */
function storage() {
  const inner = memoryStorage();
  inner.setItem(KEY, v4Text);
  const control = { failWrites: false };
  const store: KeyValueStore = {
    ...inner,
    setItem: (key, value) => {
      if (control.failWrites && key === KEY) throw new Error('quota');
      inner.setItem(key, value);
    },
  };
  return { store, control };
}

describe('config backup across the v5 migration', () => {
  it('loads v4 as v5 with default requests in flight, writing nothing', () => {
    const { store } = storage();
    const loaded = createConfigStore(store).load();
    expect(loaded.kind === 'ok' && loaded.root).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      dashboards: [
        {
          id: 'd',
          name: 'Ops',
          settings: {
            requestsInFlight: {
              github: DEFAULT_REQUESTS_IN_FLIGHT,
              aws: DEFAULT_REQUESTS_IN_FLIGHT,
            },
          },
        },
      ],
    });
    expect(store.getItem(KEY)).toBe(v4Text);
    expect(store.getItem(backupKey(V4))).toBeNull();
  });

  it('keeps a v4 configuration with an invalid dashboard unreadable and unwritten', () => {
    const store = memoryStorage();
    const text = JSON.stringify({
      schemaVersion: V4,
      dashboards: [v4Dashboard, null],
    });
    store.setItem(KEY, text);
    const config = createConfigStore(store);
    expect(config.load().kind).toBe('unreadable');
    expect(() => {
      config.save({ schemaVersion: CURRENT_SCHEMA_VERSION, dashboards: [] });
    }).toThrow(/unreadable/);
    expect(store.getItem(KEY)).toBe(text);
  });

  it('keeps the v4 original from the first save until the next one succeeds', () => {
    const { store, control } = storage();
    const config = createConfigStore(store);
    const root = () => {
      const loaded = config.load();
      if (loaded.kind !== 'ok') throw new Error('unreadable');
      return loaded.root;
    };

    config.save(root());
    expect(store.getItem(backupKey(V4))).toBe(v4Text);
    expect(JSON.parse(store.getItem(KEY) ?? '{}')).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });

    control.failWrites = true;
    expect(() => {
      config.save(root());
    }).toThrow('quota');
    expect(store.getItem(backupKey(V4))).toBe(v4Text);

    control.failWrites = false;
    config.save(root());
    expect(store.getItem(backupKey(V4))).toBeNull();
  });
});
