/**
 * Tests for the query environment (spec.md §3.1): the query defaults
 * (transient failures retry, 4xx answers never do; focus and reconnect
 * refetch only what is due; polling pauses while the tab is hidden),
 * budgets recorded from responses (only while the secret that read them
 * is current, fooboard#24), and removing only the named credentials'
 * queries and budgets.
 *
 * @module
 */
import {
  focusManager,
  onlineManager,
  QueryObserver,
} from '@tanstack/query-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type GitHubApi, isOverPollingShare } from '@/lib/github';
import { GitHubHttpError, GitHubNotFoundError } from '@/lib/github/errors';
import { fakeGitHubApi, fetched } from '@/test/fakeReaders';
import { testQueryEnv } from '@/test/queryEnv';

import { MAX_RETRIES, RETRY_BASE_DELAY_MS } from './errors';
import { ACTIVE_INTERVAL_MS, IDLE_INTERVAL_MS } from './intervals';
import { amplifyKey, githubKey } from './keys';

const runs = (repo: string) => githubKey('gh', { call: 'runs', repo, page: 1 });
/** A budget past the polling share: polling backs off. */
const OVER_SHARE = {
  limit: 5000,
  remaining: 1000,
  reset: 1,
  used: 4000,
  status: 'ok' as const,
};
/** Long enough for every retry's backoff. */
const ALL_RETRIES_MS = RETRY_BASE_DELAY_MS * 2 ** (MAX_RETRIES + 1);

describe('createQueryEnv', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
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
    // Mounted, as the QueryProvider rendering it would.
    client.mount();
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
    client.unmount();
  });

  it('refetches on reconnect only what is due', async () => {
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
    // Mounted, as the QueryProvider rendering it would.
    client.mount();
    const stops = (
      [
        ['fast', ACTIVE_INTERVAL_MS],
        ['slow', IDLE_INTERVAL_MS],
      ] as const
    ).map(([repo, interval]) =>
      new QueryObserver(client, {
        queryKey: runs(`acme/${repo}`),
        refetchInterval: interval,
        staleTime: interval,
      }).subscribe(() => undefined),
    );
    await vi.advanceTimersByTimeAsync(0);
    // Hidden and offline, so nothing polls while the fast data goes stale.
    focusManager.setFocused(false);
    onlineManager.setOnline(false);
    reads.length = 0;
    await vi.advanceTimersByTimeAsync(ACTIVE_INTERVAL_MS * 3);
    expect(reads).toEqual([]);

    onlineManager.setOnline(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(reads).toEqual(['fast']);
    for (const stop of stops) stop();
    client.unmount();
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

  it('removes only the named credentials’ queries', () => {
    const env = testQueryEnv();
    const awsKey = amplifyKey('aws', { call: 'apps', region: 'eu' });
    const other = githubKey('other', {
      call: 'runs',
      repo: 'acme/api',
      page: 1,
    });
    for (const key of [runs('acme/api'), awsKey, other])
      env.client.setQueryData(key, fetched([]));
    env.removeCredentials(['gh', 'aws']);
    expect(
      [runs('acme/api'), awsKey, other].map(
        (key) => env.client.getQueryData(key) !== undefined,
      ),
    ).toEqual([false, false, true]);
  });

  it('greys a removed credential’s battery and drops its back-off', () => {
    const env = testQueryEnv();
    const heard = vi.fn();
    env.budgets.subscribe(heard);
    env.report('gh', OVER_SHARE);
    env.report('other', OVER_SHARE);
    expect(isOverPollingShare(env.budgets.get('gh'))).toBe(true);
    heard.mockClear();

    env.removeCredentials(['gh', 'quiet']); // quiet: no budget, nothing to tell
    expect(env.budgets.get('gh')).toBeUndefined();
    expect(isOverPollingShare(env.budgets.get('gh'))).toBe(false);
    expect(env.budgets.get('other')).toEqual(OVER_SHARE);
    expect(heard).toHaveBeenCalledOnce();

    // The new token's first response fills the battery again.
    env.report('gh', { ...OVER_SHARE, used: 1 });
    expect(env.budgets.get('gh')?.used).toBe(1);
  });

  it('ignores a budget read with a secret that is no longer the credential’s (#24)', () => {
    const secrets: Record<string, string> = { gh: 'new' };
    const env = testQueryEnv({ fingerprint: (id) => secrets[id] });
    env.report('gh', OVER_SHARE, 'old');
    expect(env.budgets.get('gh')).toBeUndefined();
    env.report('gh', OVER_SHARE, 'new');
    expect(env.budgets.get('gh')).toEqual(OVER_SHARE);
  });
});
