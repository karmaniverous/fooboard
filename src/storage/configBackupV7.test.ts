/**
 * Tests for the v6 → v7 migration as stored (spec 0.2.0 §3.I): a v6 board
 * loads as v7 without writing, the first save keeps the original under
 * `fooboard:config.v6`, and the backup stays until the next successful
 * save after it.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import v6Board from '@/domain/config/fixtures/v6-board.json';
import { CURRENT_SCHEMA_VERSION } from '@/domain/config/root';

import { backupKey, createConfigStore } from './configStore';
import { memoryStorage } from './keyValue';

const KEY = 'fooboard:config';
const V6 = 6;
const v6Text = JSON.stringify({ ...v6Board, schemaVersion: V6 });

describe('config backup across the v7 migration', () => {
  it('loads v6 as v7 without writing, and keeps the original from the first save', () => {
    const store = memoryStorage();
    store.setItem(KEY, v6Text);
    const config = createConfigStore(store);
    const loaded = config.load();
    if (loaded.kind !== 'ok') throw new Error('unreadable');
    expect(loaded.root.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded.root.dashboards[0]?.unmappedDismissals).toEqual([]);
    expect(store.getItem(KEY)).toBe(v6Text);
    expect(store.getItem(backupKey(V6))).toBeNull();

    config.save(loaded.root);
    expect(store.getItem(backupKey(V6))).toBe(v6Text);
    expect(JSON.parse(store.getItem(KEY) ?? '{}')).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });

    config.save(loaded.root);
    expect(store.getItem(backupKey(V6))).toBeNull();
  });
});
