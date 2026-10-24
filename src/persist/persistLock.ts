/**
 * The one tab that persists the cache (spec.md §3.4, §3.9, Decision 28):
 * it holds a Web Lock while it writes, and the next tab waiting takes the
 * lock when it closes or stops writing (Reset). Where the browser has no
 * Web Locks, no tab persists (two writers would overwrite each other);
 * every tab still restores the cache. If the browser refuses the request,
 * the tab doesn't persist either, and says so. Reset clears the cache
 * holding the lock, so no write can land after it.
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

export interface HoldOptions {
  /** The lock is this tab's: start writing. */
  onHeld: () => void;
  /** Let the lock go once this settles (the tab stopped writing). */
  until?: Promise<void>;
  /** The browser refused the request: this tab won't write. */
  onRefused: (error: unknown) => void;
}

/**
 * Wait for the persisting lock and call `onHeld` once it is this tab's;
 * the lock is then held until the returned function releases it, `until`
 * settles or the tab closes. Released before the lock is granted, the tab
 * lets it go again at once without calling `onHeld`.
 */
export function holdPersistLock(
  locks: Locks | undefined,
  { onHeld, until, onRefused }: HoldOptions,
): () => void {
  if (!locks) return () => undefined;
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let withdrawn = false;
  locks
    .request(PERSIST_LOCK, () => {
      if (withdrawn) return undefined;
      onHeld();
      return until ? Promise.race([released, until]) : released;
    })
    .catch(onRefused);
  return () => {
    withdrawn = true;
    release();
  };
}

/**
 * Run `task` holding the persisting lock, so no tab is writing the cache
 * meanwhile (Reset's clear). Without Web Locks no tab writes, and a
 * refused request means none can, so `task` then runs at once.
 */
export async function withPersistLock(
  locks: Locks | undefined,
  task: () => Promise<void>,
): Promise<void> {
  if (!locks) return task();
  const granted = { ran: false };
  try {
    await locks.request(PERSIST_LOCK, () => {
      granted.ran = true;
      return task();
    });
  } catch (error) {
    if (granted.ran) throw error;
    await task();
  }
}
