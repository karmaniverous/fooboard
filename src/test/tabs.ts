/**
 * Test helpers for several open tabs in one test: a hub connecting tab
 * channels (each message reaches every other tab at once, as a
 * BroadcastChannel's would, later), Web Locks shared between the tabs, and
 * the stores of one tab over a device and cache store the tabs share.
 *
 * @module
 */
import type { CacheStore } from '@/persist/cacheStorage';
import { cacheStorage, memoryCacheStore } from '@/persist/cacheStorage';
import type { Locks } from '@/persist/persistLock';
import type { TabChannel, TabMessage } from '@/persist/tabChannel';
import { type AppStores, createAppStores } from '@/storage';
import { type KeyValueStore, memoryStorage } from '@/storage/keyValue';

/** Channels whose messages reach every other channel of the hub. */
export function tabHub(): { channel(): TabChannel } {
  const tabs = new Set<Set<(message: TabMessage) => void>>();
  return {
    channel() {
      const listeners = new Set<(message: TabMessage) => void>();
      tabs.add(listeners);
      return {
        post(message) {
          for (const other of tabs)
            if (other !== listeners)
              for (const listener of other) listener(message);
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      };
    },
  };
}

interface Waiting {
  name: string;
  callback: () => Promise<void> | undefined;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

/** Waiting requests, and the names held. */

/** Exclusive Web Locks shared by every tab given them. */
export function fakeLocks(): Locks & { holders(): number } {
  const held = new Set<string>();
  const queue: Waiting[] = [];
  const next = (name: string): void => {
    if (held.has(name)) return;
    const at = queue.findIndex((w) => w.name === name);
    if (at < 0) return;
    const [waiting] = queue.splice(at, 1);
    held.add(name);
    void Promise.resolve(waiting.callback())
      .then(waiting.resolve, waiting.reject)
      .finally(() => {
        held.delete(name);
        next(name);
      });
  };
  const request: Locks['request'] = (name, callback) =>
    new Promise((resolve, reject) => {
      queue.push({ name, callback, resolve, reject });
      next(name);
    });
  return { request, holders: () => held.size };
}

/** What several tabs share: local storage, IndexedDB, channel and locks. */
export interface Browser {
  device: KeyValueStore;
  idb: CacheStore & { entries: Map<string, string> };
  hub: ReturnType<typeof tabHub>;
  locks: ReturnType<typeof fakeLocks>;
}

export function browser(): Browser {
  return {
    device: memoryStorage(),
    idb: memoryCacheStore(),
    hub: tabHub(),
    locks: fakeLocks(),
  };
}

/** One tab's stores in `shared`; \`reload\` records reloads. */
export function openTab(
  shared: Browser,
  reload: () => void = () => undefined,
): AppStores {
  return createAppStores(shared.device, {
    cache: cacheStorage(shared.idb),
    tabs: shared.hub.channel(),
    locks: shared.locks,
    reload,
  });
}
