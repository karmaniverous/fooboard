/**
 * Test doubles for a browser that won't let fooboard remove secrets: a
 * device store that refuses removals once told to, and the step every
 * message and doc must give for clearing what is left.
 *
 * @module
 */
import { type KeyValueStore, memoryStorage } from '@/storage/keyValue';

/** What really removes everything: *Reset*, which clears storage and
 * the secrets held in every open tab's memory. */
export const CLEAR_EVERYTHING_STEPS = /\bUse Reset\b|_Reset_|\*\*Reset\*\*/;

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
