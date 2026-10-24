/**
 * Tests for *Reset* (spec.md C-4, §3.9, Decisions 15 and 38): the app
 * menu's last item opens a confirmation; *Cancel* changes nothing; *Reset*
 * clears every fooboard key, session secrets and the persisted cache,
 * tells the other tabs and reloads; a refused clear is reported and the
 * dialog stays open. The blocked-storage banner shows for blocked local
 * storage and for a failed cache.
 *
 * @module
 */
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { cacheStorage, memoryCacheStore } from '@/persist/cacheStorage';
import type { TabMessage } from '@/persist/tabChannel';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { refusingDevice } from '@/test/refusingDevice';
import { renderShell } from '@/test/renderShell';
import { tabHub } from '@/test/tabs';

import { Header } from './Header';
import { StorageBanner } from './StorageBanner';

const openReset = () => {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Menu' }), {
    key: 'Enter',
  });
  const last = within(screen.getByRole('menu')).getAllByRole('menuitem').at(-1);
  if (!last) throw new Error('an empty menu');
  expect(last).toHaveTextContent('Reset…');
  fireEvent.click(last);
  return screen.getByRole('alertdialog', { name: 'Reset fooboard?' });
};

/** Stores with a fooboard key, a session secret and a cached copy, whose
 * reloads and posts to other tabs are recorded. */
function filledStores(device = memoryStorage(), clear?: () => Promise<void>) {
  const idb = memoryCacheStore();
  const hub = tabHub();
  const heard: TabMessage[] = [];
  hub.channel().subscribe((m) => heard.push(m));
  const reload = vi.fn();
  const stores = createAppStores(device, {
    cache: cacheStorage(clear ? { ...idb, clear } : idb),
    tabs: hub.channel(),
    reload,
  });
  stores.preferences.setTheme('dark');
  stores.credentials.set('gh', { kind: 'github', token: 't' }, false);
  idb.entries.set('queries', '{}');
  device.setItem('other-app', 'kept');
  return { stores, idb, heard, reload, device };
}

describe('Reset', () => {
  it('changes nothing when cancelled', () => {
    const { stores, reload } = filledStores();
    renderShell(<Header />, undefined, stores);
    const dialog = openReset();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(stores.credentials.get('gh')).toBeDefined();
    expect(reload).not.toHaveBeenCalled();
  });

  it('clears every fooboard key, session secrets and the cache, in every tab, then reloads', async () => {
    const { stores, idb, heard, reload, device } = filledStores();
    renderShell(<Header />, undefined, stores);
    const dialog = openReset();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }));
    await waitFor(() => {
      expect(reload).toHaveBeenCalledOnce();
    });
    expect(device.keys()).toEqual(['other-app']);
    expect(stores.credentials.get('gh')).toBeUndefined();
    expect(idb.entries.size).toBe(0);
    expect(heard).toEqual([{ type: 'resetting' }, { type: 'reset' }]);
  });

  it('says why when the browser refuses, and stays open', async () => {
    const { device, refuse } = refusingDevice();
    const { stores, reload } = filledStores(device);
    renderShell(<Header />, undefined, stores);
    const dialog = openReset();
    refuse();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /^Not reset: .*storage refused the removal/,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('says why when the cache can’t be cleared, and stays open with nothing else cleared', async () => {
    const blocked = () =>
      Promise.reject(new DOMException('blocked', 'UnknownError'));
    const { stores, reload, idb, heard, device } = filledStores(
      memoryStorage(),
      blocked,
    );
    renderShell(<Header />, undefined, stores);
    const dialog = openReset();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /^Not reset: .*blocked/,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(idb.entries.size).toBe(1);
    expect(device.keys()).toContain('other-app');
    expect(device.keys().length).toBeGreaterThan(1);
    expect(stores.credentials.get('gh')).toBeDefined();
    expect(heard).toEqual([{ type: 'resetting' }]);
  });
});

describe('StorageBanner', () => {
  it('shows nothing while storage works', () => {
    renderShell(<StorageBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says local storage is blocked', () => {
    const stores = { ...createAppStores(memoryStorage()), persistent: false };
    renderShell(<StorageBanner />, undefined, stores);
    expect(screen.getByRole('status')).toHaveTextContent(
      /blocking storage, so nothing you set up here will be kept/,
    );
  });

  it('shows once the cache fails, as on a quota error', async () => {
    const idb = memoryCacheStore();
    const stores = createAppStores(memoryStorage(), {
      cache: cacheStorage({
        ...idb,
        setItem: () =>
          Promise.reject(new DOMException('full', 'QuotaExceededError')),
      }),
    });
    renderShell(<StorageBanner />, undefined, stores);
    expect(screen.queryByRole('status')).toBeNull();
    await act(() => stores.cache.setItem('queries', '{}'));
    expect(screen.getByRole('status')).toHaveTextContent(
      /blocking storage for fooboard's cache, so boards will load from scratch/,
    );
  });
});
