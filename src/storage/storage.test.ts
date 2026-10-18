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
import { createAppStores, deviceStorage } from './index';
import {
  clearAppData,
  type KeyValueStore,
  memoryStorage,
  webStorage,
} from './keyValue';
import { createPreferencesStore } from './preferencesStore';

describe('config store', () => {
  it('starts empty and round-trips dashboards in order', () => {
    const store = createConfigStore(memoryStorage());
    expect(store.load()).toEqual({
      kind: 'ok',
      root: { schemaVersion: 3, dashboards: [] },
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
  it('keeps the theme choice on this device, System by default', () => {
    const device = memoryStorage();
    expect(createPreferencesStore(device).getTheme()).toBe('system');
    createPreferencesStore(device).setTheme('dark');
    expect(createPreferencesStore(device).getTheme()).toBe('dark');
  });

  it('fills defaults, merges changes and forgets', () => {
    const store = createPreferencesStore(memoryStorage());
    expect(store.getView('d')).toEqual({ zoom: 1, density: 'default' });
    store.setView('d', { density: 'comfortable' });
    expect(store.setView('d', { zoom: 2 })).toEqual({
      zoom: 2,
      density: 'comfortable',
    });
    store.forget('d');
    expect(store.getView('d').zoom).toBe(1);
  });

  it('falls back to defaults when stored data is unreadable', () => {
    const kv = memoryStorage();
    kv.setItem('fooboard:device', '{"schemaVersion":1,"dashboards":7}');
    expect(createPreferencesStore(kv).getView('d').density).toBe('default');
  });

  it('migrates row height to density and resets zoom (version 1)', () => {
    const kv = memoryStorage();
    kv.setItem(
      'fooboard:device',
      JSON.stringify({
        schemaVersion: 1,
        dashboards: {
          a: { zoom: 4, rowHeight: 'full', boardSize: '2x2' },
          b: { zoom: 2, rowHeight: 'compact' },
        },
      }),
    );
    const store = createPreferencesStore(kv);
    expect(store.getView('a')).toEqual({ zoom: 1, density: 'default' });
    expect(store.getView('b')).toEqual({ zoom: 1, density: 'compact' });
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

/** A store whose writes (or reads) fail, like a full or revoked storage. */
const failing = (op: 'setItem' | 'getItem'): KeyValueStore => {
  const inner = memoryStorage();
  return {
    ...inner,
    [op]: () => {
      throw new Error(`${op} refused`);
    },
  };
};

describe('unavailable or failing storage', () => {
  it('falls back to memory, reported, when the browser blocks storage', () => {
    const blocked = deviceStorage(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(blocked.persistent).toBe(false);
    blocked.store.setItem('fooboard:x', '1');
    expect(blocked.store.getItem('fooboard:x')).toBe('1');

    const full = deviceStorage(
      () =>
        ({
          length: 0,
          key: () => null,
          getItem: () => null,
          removeItem: () => undefined,
          clear: () => undefined,
          setItem: () => {
            throw new DOMException('full', 'QuotaExceededError');
          },
        }) satisfies Storage,
    );
    expect(full.persistent).toBe(false);
  });

  it('keeps a session secret when remembering it fails to write', () => {
    const device = failing('setItem');
    const store = createCredentialStore(device);
    store.set('gh', { kind: 'github', token: '***' }, false);
    expect(() => {
      store.set('gh', { kind: 'github', token: '***' }, true);
    }).toThrow(/refused/);
    expect(store.get('gh')).toEqual({ kind: 'github', token: '***' });
  });

  it('keeps view settings in memory when they cannot be saved', () => {
    const store = createPreferencesStore(failing('setItem'));
    expect(store.setView('d', { zoom: 2 }).zoom).toBe(2);
  });

  it('reports configuration as unreadable when storage cannot be read', () => {
    const loaded = createConfigStore(failing('getItem')).load();
    expect(loaded.kind === 'unreadable' && loaded.reason).toMatch(/refused/);
  });
});
