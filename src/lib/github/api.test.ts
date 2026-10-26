/**
 * Tests for `createGitHubApi`: each method's request URL, whether a page
 * says its list goes on (runs: a full page; other lists: `Link: next`), a
 * 304 passed back for the caller's cache, a body that fails its schema,
 * and the transport's API base. Uses an injected fake `fetch`.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { response } from '@/test/fetchResponse';

import { createGitHubApi, GITHUB_PER_PAGE, pagesFor, repoRef } from './api';
import { GitHubValidationError } from './errors';
import type { FetchLike } from './httpClient';

const REF = repoRef('acme/api-core');
const BASE = 'https://api.github.com';

const run = (id: number) => ({
  id,
  head_branch: 'main',
  head_sha: `sha${String(id)}`,
  status: 'completed',
  conclusion: 'success',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  html_url: `https://github.com/acme/api-core/actions/runs/${String(id)}`,
  workflow_id: 1,
  event: 'push',
});
const job = {
  id: 1,
  run_id: 7,
  name: 'build',
  status: 'completed',
  conclusion: 'success',
  html_url: null,
};
const branch = { name: 'release/1', commit: { sha: 'b1' } };
const repo = {
  full_name: 'acme/api-core',
  name: 'api-core',
  private: false,
  html_url: 'https://github.com/acme/api-core',
  owner: { login: 'acme' },
};
const compare = { ahead_by: 1, behind_by: 0, html_url: 'h', commits: [] };
const NEXT = `<${BASE}/x?page=2>; rel="next"`;

/** An API answering every request with `res`, recording the URLs. */
function apiAnswering(res: () => Response) {
  const urls: string[] = [];
  const fetchImpl: FetchLike = (url) => {
    urls.push(url);
    return Promise.resolve(res());
  };
  return { api: createGitHubApi({ token: 't', fetchImpl }), urls };
}

describe('createGitHubApi', () => {
  it('splits owner/name into a ref', () => {
    expect(repoRef('acme/api-core')).toEqual({
      owner: 'acme',
      repo: 'api-core',
    });
    expect(repoRef('loose')).toEqual({ owner: 'loose', repo: '' });
  });

  it.each([
    [1, 1],
    [GITHUB_PER_PAGE, 1],
    [GITHUB_PER_PAGE + 1, 2],
  ])('needs %i items in %i page(s)', (count, pages) => {
    expect(pagesFor(count)).toBe(pages);
  });

  it.each([
    [GITHUB_PER_PAGE, true],
    [GITHUB_PER_PAGE - 1, false],
  ])('a runs page of %i says more follow: %s', async (count, hasNext) => {
    const runs = Array.from({ length: count }, (_, i) => run(i + 1));
    const { api, urls } = apiAnswering(() =>
      response(
        200,
        { total_count: count, workflow_runs: runs },
        { etag: '"r"' },
      ),
    );
    const res = await api.runsPage(REF, 2, '"old"');
    expect(urls).toEqual([
      `${BASE}/repos/acme/api-core/actions/runs?per_page=100&page=2&exclude_pull_requests=true`,
    ]);
    expect(res).toMatchObject({
      notModified: false,
      etag: '"r"',
      hasNext,
      redirected: false,
    });
  });

  it.each([
    ['with', { link: NEXT }, true],
    ['without', {}, false],
  ])('a jobs page %s a next link says so', async (_, headers, hasNext) => {
    const { api, urls } = apiAnswering(() =>
      response(200, { total_count: 1, jobs: [job] }, headers),
    );
    const res = await api.jobsPage(REF, 7, 2, 3);
    // The attempt asked for, never the latest: a rerun can't slip in.
    expect(urls).toEqual([
      `${BASE}/repos/acme/api-core/actions/runs/7/attempts/2/jobs?per_page=100&page=3`,
    ]);
    expect(res).toMatchObject({ data: [job], hasNext });
  });

  it('reads branches and repos page by page, following Link', async () => {
    const { api, urls } = apiAnswering(() =>
      response(200, [branch], { link: NEXT }),
    );
    expect(await api.branchesPage(REF, 1)).toMatchObject({
      data: [branch],
      hasNext: true,
    });
    const repos = apiAnswering(() => response(200, [repo]));
    expect(await repos.api.reposPage(2)).toMatchObject({
      data: [repo],
      hasNext: false,
    });
    expect([...urls, ...repos.urls]).toEqual([
      `${BASE}/repos/acme/api-core/branches?per_page=100&page=1`,
      `${BASE}/user/repos?per_page=100&page=2`,
    ]);
  });

  it('compares refs, keeping the slashes of branch names', async () => {
    const { api, urls } = apiAnswering(() => response(200, compare));
    const res = await api.compare(REF, 'release/1 a', 'main');
    expect(urls).toEqual([
      `${BASE}/repos/acme/api-core/compare/release/1%20a...main`,
    ]);
    expect(res).toMatchObject({ data: compare, hasNext: false });
  });

  it('passes a 304 back unchanged for the cached data', async () => {
    const { api } = apiAnswering(() => response(304, undefined));
    expect(await api.compare(REF, 'a', 'b', '"e"')).toEqual({
      notModified: true,
    });
  });

  it('rejects a body that fails its schema, naming the URL', async () => {
    const { api } = apiAnswering(() => response(200, { jobs: 'nope' }));
    const err = await api.jobsPage(REF, 7, 1, 1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GitHubValidationError);
    expect(String(err)).toContain('/actions/runs/7/attempts/1/jobs');
  });

  it("sends every request to the transport's API base", async () => {
    const urls: string[] = [];
    const fetchImpl: FetchLike = (url) => {
      urls.push(url);
      return Promise.resolve(response(200, [repo]));
    };
    const api = createGitHubApi({
      token: 't',
      fetchImpl,
      apiBase: 'https://sim.test/api',
    });
    await api.reposPage(1);
    await api.branchesPage(REF, 1).catch(() => undefined);
    expect(urls).toEqual([
      'https://sim.test/api/user/repos?per_page=100&page=1',
      'https://sim.test/api/repos/acme/api-core/branches?per_page=100&page=1',
    ]);
  });
});
