/**
 * Tests that the persisted cache keeps only data read with a credential's
 * remembered secret (spec.md §3.4, Decisions 27 and 38): a session-only
 * secret's data isn't written even when another tab remembers a different
 * secret under the same id; a secret replaced just before a reload, ahead
 * of the next write, brings none of the old data back; and a removal
 * heard while the cache is being restored still holds once it is, and is
 * written as soon as the tab takes the persisting lock.
 *
 * @module
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PERSIST_THROTTLE_MS } from '@/persist/persistence';
import type { Locks } from '@/persist/persistLock';
import { runsKey, seedRuns, storedCredentials } from '@/test/persisted';
import { type Browser, browser, fakeLocks, openTab, tabHub } from '@/test/tabs';

import { appQueryEnv } from './appEnv';

const github = (token: string) => ({ kind: 'github' as const, token });

/** Let the throttled write land. */
const written = () => vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);

/** A tab of `shared` whose environment is restored and persisting. */
async function tabOf(shared: Browser) {
  const stores = openTab(shared);
  const env = appQueryEnv(stores);
  await env.restored;
  await vi.advanceTimersByTimeAsync(0);
  return { stores, env };
}

/** A browser whose cache holds `gh`'s and `other`'s runs, read with their
 * remembered secrets `one` and `o`. */
async function cachedBrowser() {
  const shared = browser();
  const writer = await tabOf(shared);
  writer.stores.credentials.set('gh', github('one'), true);
  writer.stores.credentials.set('other', github('o'), true);
  seedRuns(writer.env, 'gh', 'other');
  await written();
  expect(storedCredentials(shared.idb.entries)).toEqual(['gh', 'other']);
  return { shared, writer };
}

/** Web Locks granted a task after the request, as a browser grants them. */
function laterLocks(): Locks {
  const locks = fakeLocks();
  return {
    request: (name, callback) =>
      new Promise((resolve) => setTimeout(resolve, 0)).then(() =>
        locks.request(name, callback),
      ),
  };
}

/** A new tab of `shared` whose stored copy is read only on `restore()`. */
function slowTab(shared: Browser) {
  let restore = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    restore = resolve;
  });
  const stores = openTab({
    ...shared,
    idb: {
      ...shared.idb,
      getItem: async (key) => {
        await held;
        return shared.idb.getItem(key);
      },
    },
  });
  return { stores, env: appQueryEnv(stores), restore };
}

describe('the persisted cache and a credential’s secrets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('never writes a session-only secret’s data while another tab remembers a different one', async () => {
    const shared = browser();
    const first = await tabOf(shared);
    const second = await tabOf(shared);
    first.stores.credentials.set('gh', github('session'), false);
    seedRuns(first.env, 'gh');
    second.stores.credentials.set('gh', github('remembered'), true);
    // The first tab still reads with its session secret.
    expect(first.env.client.getQueryData(runsKey('gh'))).toBeDefined();
    await written();
    expect(storedCredentials(shared.idb.entries)).toEqual([]);
  });

  it('restores none of a replaced secret’s data on a reload before the next write', async () => {
    const { shared, writer } = await cachedBrowser();
    writer.stores.credentials.set('gh', github('two'), true);
    // No write yet: the stored copy still holds the old secret’s data.
    expect(storedCredentials(shared.idb.entries)).toEqual(['gh', 'other']);

    const reloaded = await tabOf(shared);
    expect(reloaded.env.client.getQueryData(runsKey('gh'))).toBeUndefined();
    expect(reloaded.env.client.getQueryData(runsKey('other'))).toBeDefined();
  });

  it('restores none of a secret replaced while the copy is read', async () => {
    const { shared } = await cachedBrowser();
    const reloading = slowTab(shared);
    reloading.stores.credentials.set('gh', github('two'), true);
    reloading.restore();
    await reloading.env.restored;
    expect(reloading.env.client.getQueryData(runsKey('gh'))).toBeUndefined();
    expect(reloading.env.client.getQueryData(runsKey('other'))).toBeDefined();
  });

  it('applies a removal another tab sent while the copy was read', async () => {
    const { shared, writer } = await cachedBrowser();
    const reloading = slowTab(shared);
    // Another tab replaced its session secret, and sent the removal.
    writer.stores.credentials.set('gh', github('session'), false);
    writer.stores.credentials.set('gh', github('one'), true);
    expect(reloading.env.isRestored()).toBe(false);
    reloading.restore();
    await reloading.env.restored;
    expect(reloading.env.client.getQueryData(runsKey('gh'))).toBeUndefined();
    expect(reloading.env.client.getQueryData(runsKey('other'))).toBeDefined();
  });

  it('writes a secret replaced while the copy was read at once, when the lock comes after the restore', async () => {
    const { shared } = await cachedBrowser();
    // The writing tab has closed; the lock is granted a task later, as a
    // browser's is, after the restore has settled.
    const reloading = slowTab({
      ...shared,
      locks: laterLocks(),
      hub: tabHub(),
    });
    reloading.stores.credentials.set('gh', github('two'), true);
    reloading.restore();
    await reloading.env.restored;
    await vi.advanceTimersByTimeAsync(0);
    expect(storedCredentials(shared.idb.entries)).toEqual(['other']);
  });

  it('writes a removal another tab sent while the copy was read at once, when the lock comes after the restore', async () => {
    const { shared } = await cachedBrowser();
    // The writing tab has closed; the reloading tab takes the lock after
    // the restore, and hears a removal from another tab meanwhile.
    const hub = tabHub();
    const reloading = slowTab({ ...shared, locks: laterLocks(), hub });
    hub.channel().post({ type: 'remove', credentialIds: ['gh'] });
    reloading.restore();
    await reloading.env.restored;
    await vi.advanceTimersByTimeAsync(0);
    expect(storedCredentials(shared.idb.entries)).toEqual(['other']);
  });
});
