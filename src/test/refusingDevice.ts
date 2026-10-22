/**
 * Test doubles for a browser that won't let fooboard remove secrets: a
 * device store that refuses removals once told to, and the step every
 * message and doc must give for clearing what is left.
 *
 * @module
 */
import { type KeyValueStore, memoryStorage } from '@/storage/keyValue';

/** The steps that really remove everything: closing the tabs drops the
 * secrets held in their memory, then clearing the site's data removes the
 * rest. */
export const CLEAR_EVERYTHING_STEPS =
  /close every fooboard tab, then clear this site's data/i;

/** A device store that works until `refuse()`, then throws on every
 * removal, so secrets stored on it can't be forgotten. */
export function refusingDevice(): {
  device: KeyValueStore;
  refuse: () => void;
} {
  const base = memoryStorage();
  let refusing = false;
  return {
    device: {
      ...base,
      removeItem: (key) => {
        if (refusing) throw new Error('storage refused the removal');
        base.removeItem(key);
      },
    },
    refuse: () => {
      refusing = true;
    },
  };
}
