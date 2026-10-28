/**
 * Tests for the v5 → v6 migration as stored (spec.md §3.13): a v5 board
 * loads as v6 without writing, the first save keeps the original under
 * `fooboard:config.v5`, and the backup stays until the next successful
 * save after it.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import v5Board from '@/domain/config/fixtures/v5-board.json';
import { CURRENT_SCHEMA_VERSION } from '@/domain/config/root';

import { backupKey, createConfigStore } from './configStore';
import { memoryStorage } from './keyValue';

const KEY = 'fooboard:config';
const V5 = 5;
const v5Text = JSON.stringify(v5Board);

describe('config backup across the v6 migration', () => {
  it('loads v5 as v6 without writing, and keeps the original from the first save', () => {
    const store = memoryStorage();
    store.setItem(KEY, v5Text);
    const config = createConfigStore(store);
    const loaded = config.load();
    if (loaded.kind !== 'ok') throw new Error('unreadable');
    expect(loaded.root.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded.root.dashboards[0]?.settings.awsKey).toBe('aws-dev');
    expect(store.getItem(KEY)).toBe(v5Text);
    expect(store.getItem(backupKey(V5))).toBeNull();

    config.save(loaded.root);
    expect(store.getItem(backupKey(V5))).toBe(v5Text);
    expect(JSON.parse(store.getItem(KEY) ?? '{}')).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
    });

    config.save(loaded.root);
    expect(store.getItem(backupKey(V5))).toBeNull();
  });
});
