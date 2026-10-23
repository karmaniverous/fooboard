/**
 * The one tab that persists the cache (spec.md §3.4, Decision 28): it
 * holds a Web Lock for as long as it is open, and the next tab waiting
 * takes the lock when it closes. Where the browser has no Web Locks, no
 * tab persists (two writers would overwrite each other); every tab still
 * restores the cache.
 *
 * @module
 */

/** The lock's name. */
const PERSIST_LOCK = 'fooboard:persist';

/** The part of the Web Locks API the persisting tab uses (a
 * `LockManager` is one). */
export interface Locks {
  request(
    name: string,
    callback: () => Promise<void> | undefined,
  ): Promise<unknown>;
}

/**
 * Wait for the persisting lock and call `onHeld` once it is this tab's;
 * the lock is then held until the returned function releases it (or the
 * tab closes). Released before the lock is granted, the tab lets it go
 * again at once without calling `onHeld`.
 */
export function holdPersistLock(
  locks: Locks | undefined,
  onHeld: () => void,
): () => void {
  if (!locks) return () => undefined;
  let release: (() => void) | undefined;
  let released = false;
  void locks.request(PERSIST_LOCK, () => {
    if (released) return undefined;
    onHeld();
    return new Promise<void>((resolve) => {
      release = resolve;
    });
  });
  return () => {
    released = true;
    release?.();
  };
}
