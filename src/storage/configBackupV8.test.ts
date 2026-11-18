/**
 * Tests for the v7 → v8 migration as stored (spec §3.L): a v7 board loads
 * as v8 without writing, the first save keeps the original under
 * `fooboard:config.v7`, and the backup stays until the next successful
 * save after it.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import v7Board from '@/domain/config/fixtures/v7-board.json';
import { CURRENT_SCHEMA_VERSION } from '@/domain/config/root';
import { DEFAULT_HIDDEN_POLL_MS } from '@/domain/config/settings';

import { backupKey, createConfigStore } from './configStore';
import { memoryStorage } from './keyValue';

const KEY = 'fooboard:config';
const V7 = 7;
const v7Text = JSON.stringify({ ...v7Board, schemaVersion: V7 });

describe('config backup across the v8 migration', () => {
  it('loads v7 as v8 without writing, and keeps the original from the first save', () => {
    const store = memoryStorage();
    store.setItem(KEY, v7Text);
    const config = createConfigStore(store);
    const loaded = config.load();
    if (loaded.kind !== 'ok') throw new Error('unreadable');
    expect(loaded.root.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded.root.dashboards[0]?.settings.hiddenPolling.periodMs).toBe(
      DEFAULT_HIDDEN_POLL_MS,
    );
    expect(store.getItem(KEY)).toBe(v7Text);
    expect(store.getItem(backupKey(V7))).toBeNull();

    config.save(loaded.root);
    expect(store.getItem(backupKey(V7))).toBe(v7Text);

    config.save(loaded.root);
    expect(store.getItem(backupKey(V7))).toBeNull();
  });
});
