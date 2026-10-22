/**
 * Tests for the query environment (spec.md §3.1): the query defaults
 * (transient failures retry, 4xx answers never do; focus refetches only
 * what is due; polling pauses while the tab is hidden), budgets recorded
 * from responses, and a changed secret dropping only that credential's
 * queries.
 *
 * @module
 */
import { focusManager, QueryObserver } from '@tanstack/query-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GitHubApi } from '@/lib/github';
import { GitHubHttpError, GitHubNotFoundError } from '@/lib/github/errors';
import { fakeGitHubApi, fetched } from '@/test/fakeReaders';
import { testQueryEnv } from '@/test/queryEnv';

import { MAX_RETRIES, RETRY_BASE_DELAY_MS } from './errors';
import { ACTIVE_INTERVAL_MS, IDLE_INTERVAL_MS } from './intervals';
import { amplifyKey, githubKey } from './keys';

const runs = (repo: string) => githubKey('gh', { call: 'runs', repo, page: 1 });
/** Long enough for every retry's backoff. */
const ALL_RETRIES_MS = RETRY_BASE_DELAY_MS * 2 ** (MAX_RETRIES + 1);

describe('createQueryEnv', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    focusManager.setFocused(undefined);
    vi.useRealTimers();
  });

  it.each([
    ['a 404 never retries', new GitHubNotFoundError('runs'), 1],
    [
      'a 502 retries MAX_RETRIES times',
      new GitHubHttpError('runs', 502),
      MAX_RETRIES + 1,
    ],
  ])('%s', async (_label, error, calls) => {
    const runsPage = vi.fn<GitHubApi['runsPage']>(() => Promise.reject(error));
    const { client } = testQueryEnv({
      github: () => fakeGitHubApi({ runsPage }),
    });
    const settled = client
      .query({ queryKey: runs('acme/api') })
      .catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(ALL_RETRIES_MS);
    expect(await settled).toBe(error);
    expect(runsPage).toHaveBeenCalledTimes(calls);
  });

  it('refetches on focus only what is due, and polls only while visible', async () => {
    const reads: string[] = [];
    const { client } = testQueryEnv({
      github: () =>
        fakeGitHubApi({
          runsPage: ({ repo }) => {
            reads.push(repo);
            return Promise.resolve(fetched([]));
          },
        }),
    });
    const observe = (repo: string, interval: number) =>
      new QueryObserver(client, {
        queryKey: runs(`acme/${repo}`),
        refetchInterval: interval,
        staleTime: interval,
      }).subscribe(() => undefined);
    const stops = [
      observe('fast', ACTIVE_INTERVAL_MS),
      observe('slow', IDLE_INTERVAL_MS),
    ];
    await vi.advanceTimersByTimeAsync(0);
    expect(reads.sort()).toEqual(['fast', 'slow']);

    // Hidden: nothing polls, however long.
    focusManager.setFocused(false);
    reads.length = 0;
    await vi.advanceTimersByTimeAsync(ACTIVE_INTERVAL_MS * 3);
    expect(reads).toEqual([]);

    // Visible again: only the query whose data went stale refetches.
    focusManager.setFocused(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(reads).toEqual(['fast']);
    for (const stop of stops) stop();
  });

  it('records the budget a response reports, telling subscribers', () => {
    const env = testQueryEnv();
    const heard = vi.fn();
    env.budgets.subscribe(heard);
    expect(env.budgets.get('gh')).toBeUndefined();
    const budget = {
      limit: 5000,
      remaining: 4000,
      reset: 1,
      used: 1000,
      status: 'ok' as const,
    };
    env.report('gh', budget);
    expect(env.budgets.get('gh')).toEqual(budget);
    expect(heard).toHaveBeenCalledOnce();
  });

  it('drops a credential’s queries when its secret changes, only then', () => {
    const secrets: Record<string, string> = { gh: 'one', aws: 'key' };
    const env = testQueryEnv({ fingerprint: (id) => secrets[id] });
    const awsKey = amplifyKey('aws', { call: 'apps', region: 'eu' });
    const seed = () => {
      env.client.setQueryData(runs('acme/api'), fetched([]));
      env.client.setQueryData(awsKey, fetched([]));
    };
    const cached = () =>
      [runs('acme/api'), awsKey].map(
        (key) => env.client.getQueryData(key) !== undefined,
      );
    seed();
    env.secretsChanged(['gh', 'aws']); // first sight: nothing to drop
    env.secretsChanged(['gh', 'aws']); // unchanged
    expect(cached()).toEqual([true, true]);
    secrets.gh = 'two';
    env.secretsChanged(['gh', 'aws']);
    expect(cached()).toEqual([false, true]);
  });
});
