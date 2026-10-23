/**
 * Tests for the editor lookups (spec.md §3.1): a list reads page after page
 * until GitHub says it ends, through the board's queries, and stays fresh
 * for `EDITOR_STALE_MS`, so reopening an editor reads nothing.
 *
 * @module
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { amplifyApp } from '@/lib/amplify/sdkShapes';
import type { GitHubApi } from '@/lib/github';
import {
  fakeAmplifyReader,
  fakeGitHubApi,
  fetched,
  ghBranch,
  ghRepo,
} from '@/test/fakeReaders';
import { testQueryEnv } from '@/test/queryEnv';

import { EDITOR_STALE_MS } from './intervals';
import { githubKey } from './keys';
import { fetchApps, fetchBranches, fetchRepos } from './lookups';

describe('editor lookups', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads every page of a list, each page its own query', async () => {
    const reposPage = vi.fn<GitHubApi['reposPage']>((page) =>
      Promise.resolve(
        fetched([ghRepo(`acme/r${String(page)}`)], { hasNext: page < 3 }),
      ),
    );
    const { client } = testQueryEnv({
      github: () => fakeGitHubApi({ reposPage }),
    });
    const repos = await fetchRepos(client, 'gh');
    expect(repos.map((r) => r.full_name)).toEqual([
      'acme/r1',
      'acme/r2',
      'acme/r3',
    ]);
    expect(
      client.getQueryData(githubKey('gh', { call: 'repos', page: 3 })),
    ).toBeDefined();
  });

  it('reuses a lookup while fresh, reading again once stale', async () => {
    const branchesPage = vi.fn<GitHubApi['branchesPage']>(() =>
      Promise.resolve(fetched([ghBranch('main')])),
    );
    const { client } = testQueryEnv({
      github: () => fakeGitHubApi({ branchesPage }),
    });
    await fetchBranches(client, 'gh', 'acme/api');
    await fetchBranches(client, 'gh', 'acme/api');
    expect(branchesPage).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(EDITOR_STALE_MS + 1);
    expect(
      (await fetchBranches(client, 'gh', 'acme/api')).map((b) => b.name),
    ).toEqual(['main']);
    expect(branchesPage).toHaveBeenCalledTimes(2);
  });

  it('lists the Amplify apps of a region with that region’s reader', async () => {
    const listApps = vi.fn(() =>
      Promise.resolve([amplifyApp({ appId: 'a1', name: 'site' })]),
    );
    const { client } = testQueryEnv({
      amplify: () => fakeAmplifyReader({ listApps }),
    });
    expect(
      (await fetchApps(client, 'aws', 'eu-west-1')).map((a) => a.appId),
    ).toEqual(['a1']);
    await fetchApps(client, 'aws', 'eu-west-1');
    expect(listApps).toHaveBeenCalledOnce();
  });
});
