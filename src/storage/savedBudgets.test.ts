/**
 * Tests for the saved battery readings (Decision 109): only `budget:`
 * keys load, each back as a reading with its status derived; an
 * unreadable one is skipped; a save keeps the newer of the saved and the
 * new reading; `savedFor` keeps only the credentials it is told to,
 * though it removes any; and storage refusing a write isn't an error.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { RateLimitBudget } from '@/lib/github';

import { KEY_PREFIX, memoryStorage } from './keyValue';
import {
  BUDGET_KEY_PREFIX,
  createSavedBudgets,
  savedFor,
} from './savedBudgets';

const reading = (remaining: number, reset = 100): RateLimitBudget => ({
  limit: 5000,
  remaining,
  reset,
  used: 5000 - remaining,
  status: remaining <= 500 ? 'low' : 'ok',
});

describe('saved battery readings', () => {
  it('loads only readable budget keys, deriving each status', () => {
    const kv = memoryStorage();
    kv.setItem(
      `${BUDGET_KEY_PREFIX}gh`,
      JSON.stringify({ limit: 5000, remaining: 400, reset: 100, used: 4600 }),
    );
    kv.setItem(`${BUDGET_KEY_PREFIX}broken`, '{"limit":"many"}');
    kv.setItem(`${BUDGET_KEY_PREFIX}not-json`, '{');
    kv.setItem(`${KEY_PREFIX}credential:gh`, '{}');
    expect([...createSavedBudgets(kv).load()]).toEqual([['gh', reading(400)]]);
  });

  it('keeps the newer of the saved and the new reading', () => {
    const saved = createSavedBudgets(memoryStorage());
    saved.save('gh', reading(3000));
    saved.save('gh', reading(3500));
    expect(saved.load().get('gh')).toEqual(reading(3000));
    saved.save('gh', reading(4999, 200));
    expect(saved.load().get('gh')).toEqual(reading(4999, 200));
    saved.remove('gh');
    expect(saved.load().size).toBe(0);
  });

  it('keeps going when storage refuses a write', () => {
    const kv = memoryStorage();
    const refusing = {
      ...kv,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('revoked');
      },
    };
    const saved = createSavedBudgets(refusing);
    expect(() => {
      saved.save('gh', reading(3000));
      saved.remove('gh');
    }).not.toThrow();
  });

  it('savedFor keeps only the credentials it is told to, and removes any', () => {
    const inner = createSavedBudgets(memoryStorage());
    inner.save('session', reading(1000));
    const kept = savedFor(inner, (id) => id === 'gh');
    kept.save('gh', reading(3000));
    kept.save('other', reading(3000));
    expect([...kept.load().keys()]).toEqual(['gh']);
    expect([...inner.load().keys()].sort()).toEqual(['gh', 'session']);
    kept.remove('session');
    expect([...inner.load().keys()]).toEqual(['gh']);
  });
});
