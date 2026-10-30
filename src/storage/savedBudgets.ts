/**
 * Saved battery readings (spec 0.2.0 §3.J *Batteries and the first poll*,
 * Decision 109): each GitHub credential's latest rate-limit reading, in
 * local storage with the board's other data, so a reload shows the
 * batteries at once. One key per credential (`fooboard:budget:<id>`),
 * holding the counts and the reset time only, never a token. Every open
 * tab writes through the same storage, so a save keeps whichever reading
 * is newer (`supersedes`): a tab can't overwrite another's later reading
 * with an older one. *Reset* clears them with every other `fooboard:` key.
 *
 * @module
 */
import { z } from 'zod';

import { budgetFrom, type RateLimitBudget, supersedes } from '@/lib/github';

import { KEY_PREFIX, type KeyValueStore, readJson } from './keyValue';

/** The start of every saved reading's key. */
export const BUDGET_KEY_PREFIX = `${KEY_PREFIX}budget:`;

const keyFor = (credentialId: string): string =>
  `${BUDGET_KEY_PREFIX}${credentialId}`;

/** What is saved: the counts and the reset time (the status is derived). */
const SavedReadingSchema = z.object({
  limit: z.number(),
  remaining: z.number(),
  reset: z.number(),
  used: z.number(),
});

export interface SavedBudgets {
  /** Every saved reading, by credential id (an unreadable one is skipped). */
  load(): Map<string, RateLimitBudget>;
  /** Save `budget` as `credentialId`'s reading, unless the saved one (from
   * any tab) is newer. */
  save(credentialId: string, budget: RateLimitBudget): void;
  /** Remove `credentialId`'s saved reading. */
  remove(credentialId: string): void;
}

/** `saved`, limited to the credentials `keeps` (in the app, those whose
 * secret is remembered on this device: a session-only token's reading is
 * no use after a reload, when the token has gone, as the persisted cache
 * keeps only remembered secrets' reads). Loading deletes the readings of
 * credentials it doesn't keep, so one left behind (a write racing *Reset*,
 * a credential forgotten) can't come back as the reading of a new
 * credential given the same id, nor hold back that credential's readings
 * with its later reset. Removing works for any. */
export function savedFor(
  saved: SavedBudgets,
  keeps: (credentialId: string) => boolean,
): SavedBudgets {
  return {
    load() {
      const loaded = [...saved.load()];
      for (const [id] of loaded) if (!keeps(id)) saved.remove(id);
      return new Map(loaded.filter(([id]) => keeps(id)));
    },
    save(id, budget) {
      if (keeps(id)) saved.save(id, budget);
    },
    remove: (id) => {
      saved.remove(id);
    },
  };
}

export function createSavedBudgets(store: KeyValueStore): SavedBudgets {
  const read = (key: string): RateLimitBudget | undefined => {
    const parsed = SavedReadingSchema.safeParse(readJson(store, key));
    return parsed.success ? budgetFrom(parsed.data) : undefined;
  };
  // Readings are a convenience: if storage refuses a write (quota, revoked
  // access), the battery still works from memory.
  const attempt = (write: () => void): void => {
    try {
      write();
    } catch {
      // best effort
    }
  };
  return {
    load() {
      const saved = new Map<string, RateLimitBudget>();
      for (const key of store.keys()) {
        if (!key.startsWith(BUDGET_KEY_PREFIX)) continue;
        const reading = read(key);
        if (reading) saved.set(key.slice(BUDGET_KEY_PREFIX.length), reading);
      }
      return saved;
    },
    save(id, budget) {
      if (!supersedes(budget, read(keyFor(id)))) return;
      const { limit, remaining, reset, used } = budget;
      attempt(() => {
        store.setItem(
          keyFor(id),
          JSON.stringify({ limit, remaining, reset, used }),
        );
      });
    },
    remove(id) {
      attempt(() => {
        store.removeItem(keyFor(id));
      });
    },
  };
}
