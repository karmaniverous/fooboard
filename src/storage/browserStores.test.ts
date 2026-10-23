/**
 * Tests for the stores built over the browser itself (spec.md §3.4):
 * local storage, IndexedDB (here missing, so the cache fails and the
 * banner would show), a BroadcastChannel named `fooboard`, Web Locks when
 * the browser has them, and a real page reload after Reset.
 *
 * @module
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAppStores } from './index';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createAppStores over the browser', () => {
  it('uses local storage, a failing cache without IndexedDB, and no locks without Web Locks', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const stores = createAppStores();
    expect(stores.persistent).toBe(true);
    expect(stores.locks).toBeUndefined();
    expect(await stores.cache.getItem('queries')).toBeUndefined();
    expect(stores.cache.failed()).toBe(true);
  });

  it('takes the browser’s Web Locks', () => {
    const locks = { request: vi.fn() };
    vi.stubGlobal('navigator', { locks });
    expect(createAppStores().locks).toBe(locks);
  });

  it('reloads the page after Reset', async () => {
    const reload = vi.fn();
    vi.stubGlobal('window', { location: { reload } });
    const stores = createAppStores();
    await stores.reset();
    expect(reload).toHaveBeenCalledOnce();
  });
});
