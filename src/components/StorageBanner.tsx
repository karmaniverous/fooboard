/**
 * The blocked-storage banner (spec.md §2.2, §3.4): shown when the browser
 * blocks local storage, so nothing set up outlives the tab, and when
 * IndexedDB fails (a quota error, or blocked), which turns the persisted
 * cache off for the tab, so boards load from scratch after a reload.
 *
 * @module
 */
import { useSyncExternalStore } from 'react';

import { PINNED_FULL } from '@/lib/utils';
import { useStores } from '@/storage/storesContext';

/** What the banner says, by what is blocked. */
const BLOCKED_STORAGE_TEXT = {
  local:
    'This browser is blocking storage, so nothing you set up here will be kept after you close the tab.',
  cache:
    "This browser is blocking storage for fooboard's cache, so boards will load from scratch after a reload.",
} as const;

export function StorageBanner(): React.JSX.Element | null {
  const { persistent, cache } = useStores();
  const cacheFailed = useSyncExternalStore(
    (listener) => cache.subscribe(listener),
    () => cache.failed(),
  );
  if (persistent && !cacheFailed) return null;
  return (
    <p
      role="status"
      className={`${PINNED_FULL} bg-badge-behind px-5 py-1 text-center text-xs text-badge-behind-text`}
    >
      {BLOCKED_STORAGE_TEXT[persistent ? 'cache' : 'local']}
    </p>
  );
}
