/**
 * Tests for battery readings across reloads and tabs (spec 0.2.0 §3.J
 * *Batteries and the first poll*, Decision 109): a remembered secret's
 * reading is saved in local storage (its counts and reset only) and
 * shown at once when the app loads again; a session-only secret's isn't
 * kept; a restored reading whose reset has passed reads as unknown until
 * a response; *Forget*, a replaced secret or unticking *Remember*, in
 * either tab, removes the saved reading; *Reset* removes them all; and a
 * tab can't overwrite another tab's newer reading with an older one.
 *
 * @module
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RateLimitBudget } from '@/lib/github';
import { BUDGET_KEY_PREFIX } from '@/storage/savedBudgets';
import { type Browser, browser, openTab } from '@/test/tabs';

import { appQueryEnv } from './appEnv';

/** The tests' wall clock, in Unix seconds. */
const NOW_S = 1_800_000_000;
const MS_PER_SECOND = 1000;
/** A rate-limit window ending after `NOW_S`, and the one after it. */
const WINDOW = NOW_S + 600;
const NEXT_WINDOW = WINDOW + 3600;
const LIMIT = 5000;

const reading = (remaining: number, reset = WINDOW): RateLimitBudget => ({
  limit: LIMIT,
  remaining,
  reset,
  used: LIMIT - remaining,
  status: remaining <= LIMIT / 10 ? 'low' : 'ok',
});

const github = (token: string) => ({ kind: 'github' as const, token });

/** A tab of `shared` with its environment restored. */
async function tab(shared: Browser) {
  const stores = openTab(shared);
  const env = appQueryEnv(stores);
  await env.restored;
  return { stores, env };
}

/** The saved readings' keys. */
const savedKeys = (shared: Browser) =>
  shared.device.keys().filter((key) => key.startsWith(BUDGET_KEY_PREFIX));

describe('battery readings across reloads and tabs', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW_S * MS_PER_SECOND });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a remembered secret's reading at once after a reload, saving its counts and reset only", async () => {
    const shared = browser();
    const first = await tab(shared);
    first.stores.credentials.set('gh', github('ghp_secret'), true);
    first.env.budgets.note('gh', reading(4000));

    const saved = shared.device.getItem(`${BUDGET_KEY_PREFIX}gh`) ?? '';
    expect(JSON.parse(saved)).toEqual({
      limit: LIMIT,
      remaining: 4000,
      reset: WINDOW,
      used: 1000,
    });
    expect(saved).not.toContain('ghp_secret');

    const reloaded = await tab(shared);
    expect(reloaded.env.budgets.get('gh')).toEqual(reading(4000));
  });

  it('keeps no reading of a secret kept for this tab only', async () => {
    const shared = browser();
    const first = await tab(shared);
    first.stores.credentials.set('gh', github('one'), false);
    first.env.budgets.note('gh', reading(4000));
    expect(first.env.budgets.get('gh')).toEqual(reading(4000));
    expect(savedKeys(shared)).toEqual([]);
    expect((await tab(shared)).env.budgets.get('gh')).toBeUndefined();
  });

  it('shows a restored reading whose window has ended as unknown, until a response', async () => {
    const shared = browser();
    const first = await tab(shared);
    first.stores.credentials.set('gh', github('one'), true);
    first.env.budgets.note('gh', reading(100));

    vi.setSystemTime((WINDOW + 1) * MS_PER_SECOND);
    const reloaded = await tab(shared);
    expect(reloaded.env.budgets.get('gh')).toBeUndefined();
    reloaded.env.budgets.note('gh', reading(4999, NEXT_WINDOW));
    expect(reloaded.env.budgets.get('gh')).toEqual(reading(4999, NEXT_WINDOW));
  });

  it('keeps showing a reading this tab heard, once its window has ended', async () => {
    const shared = browser();
    const { stores, env } = await tab(shared);
    stores.credentials.set('gh', github('one'), true);
    env.budgets.note('gh', reading(100));
    vi.setSystemTime((WINDOW + 1) * MS_PER_SECOND);
    expect(env.budgets.get('gh')).toEqual(reading(100));
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
    [
      'unticking Remember',
      (s: ReturnType<typeof openTab>) => {
        s.credentials.set('gh', github('one'), false);
      },
    ],
  ])(
    '%s in the other tab removes the saved reading, and greys both tabs',
    async (_, change) => {
      const shared = browser();
      const first = await tab(shared);
      const second = await tab(shared);
      first.stores.credentials.set('gh', github('one'), true);
      first.stores.credentials.set('other', github('o'), true);
      first.env.budgets.note('gh', reading(4000));
      first.env.budgets.note('other', reading(3000));
      second.env.budgets.note('gh', reading(4000));

      change(second.stores);
      expect(savedKeys(shared)).toEqual([`${BUDGET_KEY_PREFIX}other`]);
      expect(first.env.budgets.get('gh')).toBeUndefined();
      expect(second.env.budgets.get('gh')).toBeUndefined();
      expect((await tab(shared)).env.budgets.get('gh')).toBeUndefined();
    },
  );

  it('Reset removes every saved reading', async () => {
    const shared = browser();
    const { stores, env } = await tab(shared);
    stores.credentials.set('gh', github('one'), true);
    stores.credentials.set('other', github('o'), true);
    env.budgets.note('gh', reading(4000));
    env.budgets.note('other', reading(3000));
    expect(savedKeys(shared)).toHaveLength(2);
    await stores.reset();
    expect(savedKeys(shared)).toEqual([]);
  });

  it("can't overwrite another tab's newer saved reading with an older one", async () => {
    const shared = browser();
    const first = await tab(shared);
    const second = await tab(shared);
    first.stores.credentials.set('gh', github('one'), true);
    first.env.budgets.note('gh', reading(3000));
    // The second tab hasn't heard that one: to it, this is news.
    second.env.budgets.note('gh', reading(3500));
    expect(second.env.budgets.get('gh')).toEqual(reading(3500));
    expect((await tab(shared)).env.budgets.get('gh')).toEqual(reading(3000));
    // A new window saves from either tab.
    second.env.budgets.note('gh', reading(4999, NEXT_WINDOW));
    expect((await tab(shared)).env.budgets.get('gh')).toEqual(
      reading(4999, NEXT_WINDOW),
    );
  });
});
