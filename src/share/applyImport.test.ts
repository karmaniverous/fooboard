/**
 * Tests for applying an import (spec.md §3.8): the configuration, then
 * the secrets (this tab only unless *Remember*), then what nothing
 * references; a refused save writes nothing; a secret that can't be
 * stored is reported with the leftover-secrets hint after the rest.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { LEFTOVER_SECRETS_HINT } from '@/storage/leftoverSecrets';
import { shareBoard } from '@/test/shareBoard';

import { applyImport } from './applyImport';
import type { ImportPlan } from './importPlan';

const gh = { kind: 'github', token: 'imported' } as const;
const plan = (more: Partial<ImportPlan> = {}): ImportPlan => ({
  dashboards: [shareBoard()],
  secrets: [{ id: 'gh-org', secret: gh }],
  forget: [],
  removed: [],
  imported: ['northwind'],
  ...more,
});

describe('applyImport', () => {
  it('saves the dashboards and keeps the secrets for this tab only', () => {
    const device = memoryStorage();
    const stores = createAppStores(device);
    applyImport(stores, plan(), false);
    const loaded = stores.config.load();
    expect(loaded.kind === 'ok' && loaded.root.dashboards).toEqual([
      shareBoard(),
    ]);
    expect(stores.credentials.get('gh-org')).toEqual(gh);
    expect(stores.credentials.isRemembered('gh-org')).toBe(false);
    expect(device.getItem('fooboard:credential:gh-org')).toBeNull();
  });

  it('remembers the secrets on this device when asked', () => {
    const device = memoryStorage();
    const stores = createAppStores(device);
    applyImport(stores, plan(), true);
    expect(stores.credentials.isRemembered('gh-org')).toBe(true);
    expect(device.getItem('fooboard:credential:gh-org')).not.toBeNull();
  });

  it('forgets unreferenced secrets and the view settings of removed dashboards', () => {
    const stores = createAppStores(memoryStorage());
    stores.credentials.set('old', gh, true);
    stores.preferences.setView('gone', { zoom: 2 });
    expect(stores.preferences.getView('gone').zoom).toBe(2);
    applyImport(stores, plan({ forget: ['old'], removed: ['gone'] }), false);
    expect(stores.credentials.get('old')).toBeUndefined();
    expect(stores.preferences.getView('gone')).toEqual(
      stores.preferences.getView('never-seen'),
    );
  });

  it('writes nothing when the configuration cannot be saved', () => {
    const device = memoryStorage();
    device.setItem('fooboard:config', 'not json');
    const stores = createAppStores(device);
    stores.credentials.set('old', gh, true);
    expect(() => {
      applyImport(stores, plan({ forget: ['old'] }), false);
    }).toThrow(/unreadable/);
    expect(stores.credentials.get('gh-org')).toBeUndefined();
    expect(stores.credentials.get('old')).toEqual(gh);
    expect(device.getItem('fooboard:config')).toBe('not json');
  });

  it('reports a secret it could not store, after the rest is done', () => {
    const stores = createAppStores(memoryStorage());
    const bad = { kind: 'github', token: '' } as const;
    let thrown: unknown;
    try {
      applyImport(
        stores,
        plan({
          secrets: [
            { id: 'aws-dev', secret: bad },
            { id: 'gh-org', secret: gh },
          ],
        }),
        false,
      );
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AggregateError);
    expect(String(thrown)).toContain(LEFTOVER_SECRETS_HINT);
    expect(stores.credentials.get('gh-org')).toEqual(gh);
    expect(stores.config.load().kind).toBe('ok');
  });
});
