/**
 * Tests for the board's observers (spec.md §3.1): the rows' needs merge to
 * one observer per query, polling at the fastest rate any row asks and
 * remembering every row it feeds; syncing observes exactly the needs
 * given; a changed version invalidates its query once (never on first
 * sight, so a reload reads nothing extra); a removed query is read
 * again at once; destroying stops observing.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import type { GitHubApi } from '@/lib/github';
import {
  ACTIVE_INTERVAL_MS,
  IDLE_INTERVAL_MS,
  pollEvery,
  SETTLED,
} from '@/query/intervals';
import { githubKey } from '@/query/keys';
import { fakeGitHubApi, fetched } from '@/test/fakeReaders';
import { testQueryEnv } from '@/test/queryEnv';

import type { Need } from './need';
import { createObserverSet, mergeNeeds } from './observers';

const key = (runId: number) =>
  githubKey('gh', {
    call: 'jobs',
    repo: 'acme/api',
    runId,
    attempt: 1,
    page: 1,
  });
const fast = pollEvery(ACTIVE_INTERVAL_MS, false);
const slow = pollEvery(IDLE_INTERVAL_MS, false);
const need = (runId: number, extra: Partial<Need> = {}): Need => ({
  key: key(runId),
  freshness: slow,
  ...extra,
});

/** A client whose jobs reads are counted. */
function setup() {
  const jobsPage = vi.fn<GitHubApi['jobsPage']>(() =>
    Promise.resolve(fetched([])),
  );
  const env = testQueryEnv({ github: () => fakeGitHubApi({ jobsPage }) });
  const observers = createObserverSet(env.client);
  const observersOf = (runId: number) =>
    env.client
      .getQueryCache()
      .find({ queryKey: key(runId) })
      ?.getObserversCount() ?? 0;
  return { env, observers, jobsPage, observersOf };
}

describe('mergeNeeds', () => {
  it('merges a query several rows need, at the fastest rate, feeding each', () => {
    const merged = mergeNeeds([
      ['a', [need(1), need(2, { freshness: SETTLED })]],
      ['b', [need(1, { freshness: fast })]],
    ]);
    expect(merged.size).toBe(2);
    const [first] = merged.values();
    expect(first.freshness).toEqual(fast);
    expect([...first.feeds]).toEqual(['a', 'b']);
  });
});

describe('createObserverSet', () => {
  it('observes exactly the needs synced, and nothing after destroy', async () => {
    const { observers, observersOf, jobsPage } = setup();
    observers.sync(mergeNeeds([['a', [need(1), need(2)]]]));
    expect(observers.size()).toBe(2);
    await vi.waitFor(() => {
      expect(jobsPage).toHaveBeenCalledTimes(2);
    });
    observers.sync(mergeNeeds([['a', [need(2)]]]));
    expect([observersOf(1), observersOf(2)]).toEqual([0, 1]);
    observers.destroy();
    expect([observers.size(), observersOf(2)]).toEqual([0, 0]);
  });

  it('applies a changed poll rate to the observer it has', () => {
    const { env, observers } = setup();
    observers.sync(mergeNeeds([['a', [need(1)]]]));
    observers.sync(mergeNeeds([['a', [need(1, { freshness: fast })]]]));
    const [observer] =
      env.client.getQueryCache().find({ queryKey: key(1) })?.observers ?? [];
    expect(observer.options.refetchInterval).toBe(ACTIVE_INTERVAL_MS);
    observers.destroy();
  });

  it('invalidates a query once when its version changes, not on first sight', async () => {
    const { env, observers, jobsPage } = setup();
    const invalidated = () =>
      env.client.getQueryState(key(1))?.isInvalidated ?? false;
    const settled = (version: string) =>
      mergeNeeds([['a', [need(1, { freshness: SETTLED, version })]]]);
    observers.sync(settled('in_progress'));
    await vi.waitFor(() => {
      expect(env.client.getQueryData(key(1))).toBeDefined();
    });
    observers.sync(settled('in_progress'));
    expect(invalidated()).toBe(false);
    observers.sync(settled('completed'));
    expect(invalidated()).toBe(true);
    await vi.waitFor(() => {
      expect(jobsPage).toHaveBeenCalledTimes(2);
    });
    await vi.waitFor(() => {
      expect(invalidated()).toBe(false);
    });
    // A second set on the same client remembers the version seen.
    const again = createObserverSet(env.client);
    again.sync(settled('completed'));
    expect(invalidated()).toBe(false);
    observers.destroy();
    again.destroy();
  });

  it('reads a removed query again at once, not at its next poll', async () => {
    const { env, observers, jobsPage, observersOf } = setup();
    const needs = mergeNeeds([['a', [need(1)]]]);
    observers.sync(needs);
    await vi.waitFor(() => {
      expect(env.client.getQueryData(key(1))).toBeDefined();
    });
    env.client.removeQueries({ queryKey: key(1) });
    observers.sync(needs);
    expect(observersOf(1)).toBe(1);
    await vi.waitFor(() => {
      expect(jobsPage).toHaveBeenCalledTimes(2);
    });
    expect(observers.size()).toBe(1);
    observers.destroy();
  });
});
