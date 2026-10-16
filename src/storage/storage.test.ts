/**
 * Tests for the local stores (spec.md C-1, C-4, C-5, C-13): the config
 * store's round trip and its refusal to overwrite unreadable data, view
 * preferences with defaults, secrets kept on the device or the session
 * only, independent copies, and *Reset* touching only fooboard keys.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';

import { createConfigStore } from './configStore';
import { createCredentialStore } from './credentialStore';
import { createAppStores } from './index';
import { clearAppData, memoryStorage, webStorage } from './keyValue';
import { createPreferencesStore } from './preferencesStore';

describe('config store', () => {
  it('starts empty and round-trips dashboards in order', () => {
    const store = createConfigStore(memoryStorage());
    expect(store.load()).toEqual({
      kind: 'ok',
      root: { schemaVersion: 1, dashboards: [] },
    });
    const second = { ...demoDashboard, id: 'second', name: 'Second' };
    store.saveDashboard(demoDashboard);
    store.saveDashboard(second);
    store.saveDashboard({ ...demoDashboard, name: 'Renamed' });
    const loaded = store.load();
    expect(
      loaded.kind === 'ok' && loaded.root.dashboards.map((d) => d.name),
    ).toEqual(['Renamed', 'Second']);
    store.removeDashboard('second');
    expect(loaded.kind === 'ok' && store.load()).toMatchObject({
      root: { dashboards: [{ id: 'demo' }] },
    });
  });

  it.each([
    ['not JSON', '{oops'],
    ['an unknown schema version', '{"schemaVersion":99,"dashboards":[]}'],
  ])('reports %s and refuses to overwrite it', (_label, stored) => {
    const kv = memoryStorage();
    kv.setItem('fooboard:config', stored);
    const store = createConfigStore(kv);
    expect(store.load().kind).toBe('unreadable');
    expect(() => {
      store.saveDashboard(demoDashboard);
    }).toThrow(/Refusing to overwrite/);
    expect(kv.getItem('fooboard:config')).toBe(stored);
  });
});

describe('preferences store', () => {
  it('fills defaults, merges changes and forgets', () => {
    const store = createPreferencesStore(memoryStorage());
    expect(store.getView('d')).toEqual({ zoom: 1, rowHeight: 'compact' });
    store.setView('d', { rowHeight: 'full' });
    expect(store.setView('d', { zoom: 2 })).toEqual({
      zoom: 2,
      rowHeight: 'full',
    });
    store.forget('d');
    expect(store.getView('d').zoom).toBe(1);
  });

  it('falls back to defaults when stored data is unreadable', () => {
    const kv = memoryStorage();
    kv.setItem('fooboard:device', '{"schemaVersion":1,"dashboards":7}');
    expect(createPreferencesStore(kv).getView('d').rowHeight).toBe('compact');
  });
});

describe('credential store', () => {
  const token = { kind: 'github' as const, token: 'ghp_x' };

  it('keeps a secret in the session unless remembered', () => {
    const device = memoryStorage();
    const store = createCredentialStore(device);
    store.set('gh', token, false);
    expect(store.get('gh')).toEqual(token);
    expect(device.keys()).toEqual([]);

    store.set('gh', token, true);
    expect(store.isRemembered('gh')).toBe(true);
    store.clearSession();
    expect(store.get('gh')).toEqual(token);

    store.set('gh', token, false);
    expect(device.keys()).toEqual([]);
  });

  it('forgets from both the device and the session', () => {
    const store = createCredentialStore(memoryStorage());
    store.set('gh', token, true);
    store.forget('gh');
    expect(store.get('gh')).toBeUndefined();
  });

  it('copies as an independent secret with the same storage choice', () => {
    const store = createCredentialStore(memoryStorage());
    store.set('gh', token, true);
    store.copy('gh', 'gh-copy');
    store.forget('gh');
    expect(store.get('gh-copy')).toEqual(token);
    expect(store.isRemembered('gh-copy')).toBe(true);
  });

  it('tells subscribers which credential changed', () => {
    const store = createCredentialStore(memoryStorage());
    const seen: string[] = [];
    store.subscribe((id) => seen.push(id));
    store.set('gh', token, false);
    store.forget('aws');
    expect(seen).toEqual(['gh', 'aws']);
  });
});

describe('clearAppData', () => {
  it('removes only fooboard keys', () => {
    const kv = memoryStorage();
    kv.setItem('fooboard:config', '{}');
    kv.setItem('fooboard:credential:gh', '{}');
    kv.setItem('other-app', 'keep');
    clearAppData(kv);
    expect(kv.keys()).toEqual(['other-app']);
  });
});

describe('createAppStores reset', () => {
  it('clears remembered and session secrets and the config', () => {
    const kv = memoryStorage();
    const stores = createAppStores(kv);
    stores.config.saveDashboard(demoDashboard);
    stores.credentials.set('a', { kind: 'github', token: 't' }, true);
    stores.credentials.set('b', { kind: 'github', token: 't' }, false);
    stores.reset();
    expect(stores.credentials.get('a')).toBeUndefined();
    expect(stores.credentials.get('b')).toBeUndefined();
    expect(kv.keys()).toEqual([]);
  });
});

describe('webStorage', () => {
  it('adapts browser local storage, including listing keys', () => {
    localStorage.clear();
    const kv = webStorage(localStorage);
    kv.setItem('fooboard:a', '1');
    kv.setItem('other', '2');
    clearAppData(kv);
    expect(kv.keys()).toEqual(['other']);
    expect(kv.getItem('other')).toBe('2');
  });
});
