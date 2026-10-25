/**
 * Tests for the fetch layer (spec.md §3.1, §3.3, Decision 21): each GitHub
 * request is conditional on the ETag kept in the cached data and a 304
 * reuses it; a first page that lands with new data invalidates the list's
 * later pages; GitHub rate limits and Amplify throttles pause the
 * credential's limiter before its slot frees; a credential without a
 * secret fails with `MissingCredentialError`; every request runs through
 * the instrumentation hook.
 *
 * @module
 */
import type { App } from '@aws-sdk/client-amplify';
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it, vi } from 'vitest';

import { AmplifyAuthError, AmplifyThrottledError } from '@/lib/amplify/errors';
import { createGitHubApi, type GitHubApi } from '@/lib/github';
import { RateLimitedError } from '@/lib/github/errors';
import {
  fakeAmplifyReader,
  fakeGitHubApi,
  fetched,
  ghRepo,
} from '@/test/fakeReaders';
import { response } from '@/test/fetchResponse';

import { createQueryFn, MissingCredentialError } from './fetchers';
import { type Around, passThrough, type RequestCall } from './instrument';
import { amplifyKey, githubKey } from './keys';
import { createLimiters } from './limiters';
import { createReadWith } from './readWith';

const NOW = 1_000_000;
const REPO = 'acme/api';
const runs = (page: number) =>
  githubKey('gh', { call: 'runs', repo: REPO, page });
const repos = (page: number) => githubKey('gh', { call: 'repos', page });

/** A client whose queries fetch through `api` (or none) for every token. */
function setup(
  api: GitHubApi | undefined,
  {
    around = passThrough,
    fingerprint = () => 'secret',
    listApps = () =>
      Promise.reject(new AmplifyThrottledError('slow down', 'ListApps', 7_000)),
  }: {
    around?: Around;
    fingerprint?: () => string;
    listApps?: () => Promise<App[]>;
  } = {},
) {
  const limiters = createLimiters({ now: () => NOW });
  const readWith = createReadWith();
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: createQueryFn({
          providers: {
            github: () => api,
            amplify: () => () => fakeAmplifyReader({ listApps }),
            fingerprint,
          },
          limiters,
          now: () => NOW,
          around: () => around,
          readWith,
        }),
      },
    },
  });
  return { client, limiters, readWith };
}

describe('createQueryFn', () => {
  it('notes the secret an answer was sent with as it lands, and nothing for a failure', async () => {
    let secret = 'one';
    let land = (): void => undefined;
    const runsPage = vi
      .fn<GitHubApi['runsPage']>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            land = () => {
              resolve(fetched([]));
            };
          }),
      )
      .mockRejectedValueOnce(new Error('offline'));
    const { client, readWith } = setup(fakeGitHubApi({ runsPage }), {
      fingerprint: () => secret,
    });
    const noted = (page: number) => {
      const query = client
        .getQueryCache()
        .find({ queryKey: runs(page), exact: true });
      return query && readWith.of(query);
    };
    const answer = client.query({ queryKey: runs(1) });
    await vi.waitFor(() => {
      expect(runsPage).toHaveBeenCalledOnce();
    });
    secret = 'two';
    land();
    await answer;
    expect(noted(1)).toBe('one');
    await client.query({ queryKey: runs(2) }).catch(() => undefined);
    expect(noted(2)).toBeUndefined();
  });

  it('sends the cached ETag and reuses the cached data on a 304', async () => {
    const reposPage = vi
      .fn<GitHubApi['reposPage']>()
      .mockResolvedValueOnce(fetched([ghRepo('acme/api')], { etag: 'e1' }))
      .mockResolvedValueOnce({ notModified: true });
    const { client } = setup(fakeGitHubApi({ reposPage }));
    const first = await client.query({ queryKey: repos(1) });
    await client.refetchQueries({ queryKey: repos(1) });
    expect(reposPage).toHaveBeenNthCalledWith(1, 1, undefined);
    expect(reposPage).toHaveBeenNthCalledWith(2, 1, 'e1');
    expect(client.getQueryData(repos(1))).toBe(first);
  });

  it('invalidates later pages when the first page lands with new data', async () => {
    const reposPage = vi
      .fn<GitHubApi['reposPage']>()
      .mockResolvedValueOnce(
        fetched([ghRepo('acme/a')], { etag: 'e1', hasNext: true }),
      )
      .mockResolvedValueOnce(fetched([ghRepo('acme/b')], { etag: 'p2' }))
      .mockResolvedValueOnce({ notModified: true })
      .mockResolvedValueOnce(
        fetched([ghRepo('acme/new')], { etag: 'e2', hasNext: true }),
      );
    const { client } = setup(fakeGitHubApi({ reposPage }));
    await client.query({ queryKey: repos(1) });
    await client.query({ queryKey: repos(2) });
    const pageTwo = () => client.getQueryState(repos(2))?.isInvalidated;

    await client.refetchQueries({ queryKey: repos(1) }); // 304
    expect(pageTwo()).toBe(false);
    await client.refetchQueries({ queryKey: repos(1) }); // new data
    expect(pageTwo()).toBe(true);
  });

  it('pauses the token at GitHub’s reset on a rate limit', async () => {
    const retryAt = NOW + 60_000;
    const { client, limiters } = setup(
      fakeGitHubApi({
        runsPage: () => Promise.reject(new RateLimitedError('runs', retryAt)),
      }),
    );
    await expect(client.query({ queryKey: runs(1) })).rejects.toThrow(
      RateLimitedError,
    );
    expect(limiters.for('github', 'gh').stats().pausedUntil).toBe(retryAt);
  });

  it('pauses the AWS key for the delay a throttle suggests', async () => {
    const { client, limiters } = setup(undefined);
    await expect(
      client.query({
        queryKey: amplifyKey('aws', { call: 'apps', region: 'eu-west-1' }),
      }),
    ).rejects.toThrow(AmplifyThrottledError);
    expect(limiters.for('amplify', 'aws').stats().pausedUntil).toBe(
      NOW + 7_000,
    );
    expect(limiters.for('github', 'aws').stats().pausedUntil).toBe(0);
  });

  it('answers a region the app search skips, rather than failing (§3.12)', async () => {
    const apps = (region: string, listApps: () => Promise<App[]>) =>
      setup(undefined, { listApps }).client.query({
        queryKey: amplifyKey('aws', { call: 'apps', region }),
      });
    await expect(
      apps('eu-west-1', () =>
        Promise.reject(new AmplifyAuthError('denied', 'ListApps', true)),
      ),
    ).resolves.toMatchObject({ data: { apps: [], skipped: 'denied' } });
    await expect(
      apps('me-south-1', () =>
        Promise.reject(new TypeError('Failed to fetch')),
      ),
    ).resolves.toMatchObject({ data: { apps: [], skipped: 'unavailable' } });
    await expect(
      apps('us-east-1', () => Promise.reject(new TypeError('Failed to fetch'))),
    ).rejects.toThrow(TypeError);
  });

  it('fails a request for a credential without a secret', async () => {
    const { client } = setup(undefined);
    await expect(client.query({ queryKey: runs(1) })).rejects.toBeInstanceOf(
      MissingCredentialError,
    );
  });

  it('reads the jobs of the attempt its key names, never the latest', async () => {
    const urls: string[] = [];
    const api = createGitHubApi({
      token: 't',
      fetchImpl: (url) => {
        urls.push(url);
        return Promise.resolve(response(200, { total_count: 0, jobs: [] }));
      },
    });
    const { client } = setup(api);
    const key = githubKey('gh', {
      call: 'jobs',
      repo: REPO,
      runId: 7,
      attempt: 2,
      page: 3,
    });
    await client.query({ queryKey: key });
    expect(urls).toEqual([
      'https://api.github.com/repos/acme/api/actions/runs/7/attempts/2/jobs?per_page=100&page=3',
    ]);
  });

  it('runs every request through the instrumentation hook', async () => {
    const calls: RequestCall[] = [];
    const around: Around = (call, run) => {
      calls.push(call);
      return run();
    };
    const { client } = setup(
      fakeGitHubApi({ runsPage: () => Promise.resolve(fetched([])) }),
      { around },
    );
    await client.query({ queryKey: runs(1) });
    expect(calls).toEqual([
      { provider: 'github', kind: 'runs', credentialId: 'gh', repo: REPO },
    ]);
  });

  it('leaves the other pages alone when a later page lands with new data', async () => {
    const reposPage = vi.fn<GitHubApi['reposPage']>((page) =>
      Promise.resolve(
        fetched([ghRepo(`acme/p${String(page)}`)], { hasNext: page < 3 }),
      ),
    );
    const { client } = setup(fakeGitHubApi({ reposPage }));
    for (const page of [1, 2, 3]) await client.query({ queryKey: repos(page) });
    await client.refetchQueries({ queryKey: repos(2) });
    expect(client.getQueryState(repos(3))?.isInvalidated).toBe(false);
  });
});
