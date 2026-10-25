/**
 * Tests for the persisted cache across open tabs (spec.md §3.4, §3.9,
 * Decisions 28 and 38): only one tab writes it; *Forget* or a replaced
 * secret in one tab removes the credential's queries in every tab, so
 * nothing of it stays in IndexedDB while another tab is open; Reset in one
 * tab clears every fooboard key, session secrets and the cache, and makes
 * every tab clear and reload, with no write landing afterwards.
 *
 * @module
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import { PERSIST_THROTTLE_MS } from '@/persist/persistence';
import { dashboardsOf } from '@/storage/configStore';
import { runsKey, seedRuns, storedCredentials } from '@/test/persisted';
import { browser, openTab } from '@/test/tabs';

import { type AppQueryEnv, appQueryEnv } from './appEnv';

const github = (token: string) => ({ kind: 'github' as const, token });

/** Two tabs of one browser; the first holds the persisting lock. */
async function twoTabs() {
  const shared = browser();
  const reloads = { first: 0, second: 0 };
  const open = (name: keyof typeof reloads) => {
    const stores = openTab(shared, () => {
      reloads[name] += 1;
    });
    return { stores, env: appQueryEnv(stores) };
  };
  const first = open('first');
  await first.env.restored;
  await vi.advanceTimersByTimeAsync(0);
  const second = open('second');
  await second.env.restored;
  const written = () => vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
  return { shared, first, second, reloads, written };
}

describe('the persisted cache across tabs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is written by one tab only', async () => {
    const { shared, first, second, written } = await twoTabs();
    first.stores.credentials.set('a', github('a'), true);
    first.stores.credentials.set('b', github('b'), true);
    seedRuns(first.env, 'a');
    seedRuns(second.env, 'b');
    await written();
    expect(storedCredentials(shared.idb.entries)).toEqual(['a']);
    expect(shared.locks.holders()).toBe(1);
  });

  it.each([
    [
      'Forget',
      (s: ReturnType<typeof openTab>) => {
        s.credentials.forget('gh');
      },
    ],
    [
      'a replaced secret',
      (s: ReturnType<typeof openTab>) => {
        s.credentials.set('gh', github('two'), true);
      },
    ],
  ])('%s in the other tab leaves no data in IndexedDB', async (_, change) => {
    const { shared, first, second, written } = await twoTabs();
    first.stores.credentials.set('gh', github('one'), true);
    first.stores.credentials.set('other', github('o'), true);
    seedRuns(first.env, 'gh', 'other');
    seedRuns(second.env, 'gh');
    await written();
    expect(storedCredentials(shared.idb.entries)).toEqual(['gh', 'other']);

    change(second.stores);
    // Every tab drops the credential's queries, the writer included.
    expect(first.env.client.getQueryData(runsKey('gh'))).toBeUndefined();
    expect(second.env.client.getQueryData(runsKey('gh'))).toBeUndefined();
    await written();
    expect(storedCredentials(shared.idb.entries)).toEqual(['other']);
  });

  it('Reset in the other tab clears everything, and every tab reloads', async () => {
    const { shared, first, second, reloads, written } = await twoTabs();
    first.stores.credentials.set('gh', github('one'), true);
    first.stores.credentials.set('session', github('s'), false);
    first.stores.config.saveDashboard(measureBoard);
    shared.device.setItem('other-app', 'kept');
    seedRuns(first.env, 'gh');
    await written();
    // A write still pending in the writing tab when Reset comes.
    first.env.client.setQueryData(runsKey('gh', 'acme/web'), []);

    await second.stores.reset();
    await written();
    expect(shared.idb.entries.size).toBe(0);
    expect(shared.device.keys()).toEqual(['other-app']);
    expect(first.stores.credentials.get('session')).toBeUndefined();
    expect(reloads).toEqual({ first: 1, second: 1 });
  });

  it('Reset clears the cache only once a write under way has landed', async () => {
    const shared = browser();
    let land = (): void => undefined;
    const writer = openTab({
      ...shared,
      idb: {
        ...shared.idb,
        setItem: (key, value) =>
          new Promise<void>((resolve) => {
            land = () => {
              shared.idb.entries.set(key, value);
              resolve();
            };
          }),
      },
    });
    const writerEnv = appQueryEnv(writer);
    await writerEnv.restored;
    await vi.advanceTimersByTimeAsync(0);
    const resetting = openTab(shared);
    await appQueryEnv(resetting).restored;
    writer.credentials.set('gh', github('one'), true);
    seedRuns(writerEnv, 'gh');
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);

    const reset = resetting.reset();
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    land();
    await reset;
    expect(shared.idb.entries.size).toBe(0);
  });

  it('Reset clears the shared storage before another tab reloads, so it reloads to nothing', async () => {
    const shared = browser();
    // The other tab, rebuilt from the shared storage when it reloads.
    const rebuilt: { stores: ReturnType<typeof openTab>; env: AppQueryEnv }[] =
      [];
    const other = openTab(shared, () => {
      const stores = openTab(shared);
      rebuilt.push({ stores, env: appQueryEnv(stores) });
    });
    const otherEnv = appQueryEnv(other);
    await otherEnv.restored;
    await vi.advanceTimersByTimeAsync(0);
    // The resetting tab, whose clear of the cache takes a while.
    let cleared = (): void => undefined;
    const clearing = new Promise<void>((resolve) => {
      cleared = resolve;
    });
    const resetting = openTab({
      ...shared,
      idb: {
        ...shared.idb,
        clear: async () => {
          await clearing;
          await shared.idb.clear();
        },
      },
    });
    await appQueryEnv(resetting).restored;
    other.credentials.set('gh', github('one'), true);
    other.config.saveDashboard(measureBoard);
    seedRuns(otherEnv, 'gh');
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);

    const reset = resetting.reset();
    await vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
    expect(rebuilt).toEqual([]);
    cleared();
    await reset;
    expect(rebuilt).toHaveLength(1);
    const [after] = rebuilt;
    await after.env.restored;
    expect(dashboardsOf(after.stores.config.load())).toEqual([]);
    expect(after.stores.credentials.get('gh')).toBeUndefined();
    expect(after.env.client.getQueryCache().getAll()).toEqual([]);
    expect(shared.idb.entries.size).toBe(0);
  });
});
