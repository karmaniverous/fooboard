/**
 * Tests for `createGitHubReader`: each method calls the right path, parses
 * the response into the documented shape, rejects malformed payloads, and
 * pagination follows `Link` headers. Uses an injected fake `fetch`; no real
 * network.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { GitHubValidationError } from './errors';
import type { FetchLike } from './httpClient';
import { createGitHubReader } from './reader';

function jsonResponse(
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), { status: 200, headers });
}

function fakeFetch(handlers: Record<string, () => Response>): {
  fetchImpl: FetchLike;
  calls: string[];
} {
  const calls: string[] = [];
  const fetchImpl: FetchLike = (url) => {
    calls.push(url);
    const handler = handlers[url] as (() => Response) | undefined;
    if (!handler) throw new Error(`unexpected URL: ${url}`);
    return Promise.resolve(handler());
  };
  return { fetchImpl, calls };
}

const repo = { owner: 'acme', repo: 'api-core' };

describe('createGitHubReader', () => {
  it('listWorkflowRuns requests per_page and exclude_pull_requests, and parses the envelope', async () => {
    const url =
      'https://api.github.com/repos/acme/api-core/actions/runs?per_page=100&exclude_pull_requests=true';
    const { fetchImpl } = fakeFetch({
      [url]: () =>
        jsonResponse({
          total_count: 1,
          workflow_runs: [
            {
              id: 1,
              name: 'CI',
              head_branch: 'main',
              head_sha: 'abc123',
              status: 'completed',
              conclusion: 'success',
              created_at: '2026-10-16T00:00:00Z',
              updated_at: '2026-10-16T00:01:00Z',
              html_url: 'https://github.com/acme/api-core/actions/runs/1',
              workflow_id: 10,
              event: 'push',
            },
          ],
        }),
    });
    const reader = createGitHubReader({ token: 't', fetchImpl });
    const runs = await reader.listWorkflowRuns(repo);
    expect(runs).toHaveLength(1);
    expect(runs[0].head_branch).toBe('main');
  });

  it('listRunJobs follows pages, so a job on page two is not lost', async () => {
    const base =
      'https://api.github.com/repos/acme/api-core/actions/runs/1/jobs?filter=latest&per_page=100';
    const page2 = `${base}&page=2`;
    const job = (id: number, name: string) => ({
      id,
      run_id: 1,
      name,
      status: 'completed',
      conclusion: 'success',
      html_url: `https://github.com/acme/api-core/actions/runs/1/jobs/${String(id)}`,
    });
    const { fetchImpl } = fakeFetch({
      [base]: () =>
        jsonResponse(
          { total_count: 2, jobs: [job(5, 'lint')] },
          { link: `<${page2}>; rel="next"` },
        ),
      [page2]: () => jsonResponse({ total_count: 2, jobs: [job(6, 'deploy')] }),
    });
    const reader = createGitHubReader({ token: 't', fetchImpl });
    const jobs = await reader.listRunJobs(repo, 1);
    expect(jobs.map((j) => j.name)).toEqual(['lint', 'deploy']);
  });

  it('matchingRefs requests /git/matching-refs/heads/{prefix}', async () => {
    const url =
      'https://api.github.com/repos/acme/api-core/git/matching-refs/heads/release/';
    const { fetchImpl } = fakeFetch({
      [url]: () =>
        jsonResponse([
          { ref: 'refs/heads/release/24.3', object: { sha: 'abc' } },
        ]),
    });
    const reader = createGitHubReader({ token: 't', fetchImpl });
    const refs = await reader.matchingRefs(repo, 'release/');
    expect(refs).toEqual([
      { ref: 'refs/heads/release/24.3', object: { sha: 'abc' } },
    ]);
  });

  it('compare fetches both directions and combines ahead/behind commit subjects', async () => {
    const forwardUrl =
      'https://api.github.com/repos/acme/api-core/compare/main...feature';
    const reverseUrl =
      'https://api.github.com/repos/acme/api-core/compare/feature...main';
    const { fetchImpl } = fakeFetch({
      [forwardUrl]: () =>
        jsonResponse({
          ahead_by: 2,
          behind_by: 1,
          html_url: 'https://github.com/acme/api-core/compare/main...feature',
          commits: [
            { sha: 'a', commit: { message: 'first commit\nmore body' } },
            { sha: 'b', commit: { message: 'second commit' } },
          ],
        }),
      [reverseUrl]: () =>
        jsonResponse({
          ahead_by: 1,
          behind_by: 2,
          html_url: 'https://github.com/acme/api-core/compare/feature...main',
          commits: [{ sha: 'c', commit: { message: 'hotfix on main' } }],
        }),
    });
    const reader = createGitHubReader({ token: 't', fetchImpl });
    const result = await reader.compare(repo, 'main', 'feature');
    expect(result).toEqual({
      aheadBy: 2,
      behindBy: 1,
      htmlUrl: 'https://github.com/acme/api-core/compare/main...feature',
      aheadCommitSubjects: ['second commit', 'first commit'],
      behindCommitSubjects: ['hotfix on main'],
    });
  });

  it('listBranches follows pagination via the Link header', async () => {
    const page1 =
      'https://api.github.com/repos/acme/api-core/branches?per_page=100';
    const page2 = 'https://api.github.com/repos/acme/api-core/branches?page=2';
    const { fetchImpl } = fakeFetch({
      [page1]: () =>
        jsonResponse([{ name: 'main', commit: { sha: 'a' } }], {
          link: `<${page2}>; rel="next"`,
        }),
      [page2]: () =>
        jsonResponse([{ name: 'release/24.3', commit: { sha: 'b' } }]),
    });
    const reader = createGitHubReader({ token: 't', fetchImpl });
    const branches = await reader.listBranches(repo);
    expect(branches.map((b) => b.name)).toEqual(['main', 'release/24.3']);
  });

  it('listRepos follows pagination via the Link header', async () => {
    const page1 = 'https://api.github.com/user/repos?per_page=100';
    const { fetchImpl } = fakeFetch({
      [page1]: () =>
        jsonResponse([
          {
            full_name: 'acme/api-core',
            name: 'api-core',
            private: false,
            html_url: 'https://github.com/acme/api-core',
            owner: { login: 'acme' },
          },
        ]),
    });
    const reader = createGitHubReader({ token: 't', fetchImpl });
    const repos = await reader.listRepos();
    expect(repos).toEqual([
      {
        full_name: 'acme/api-core',
        name: 'api-core',
        private: false,
        html_url: 'https://github.com/acme/api-core',
        owner: { login: 'acme' },
      },
    ]);
  });

  it('listWorkflows parses workflow names', async () => {
    const url =
      'https://api.github.com/repos/acme/api-core/actions/workflows?per_page=100';
    const { fetchImpl } = fakeFetch({
      [url]: () =>
        jsonResponse({
          total_count: 1,
          workflows: [
            {
              id: 1,
              name: 'CI',
              path: '.github/workflows/ci.yml',
              state: 'active',
            },
          ],
        }),
    });
    const reader = createGitHubReader({ token: 't', fetchImpl });
    const workflows = await reader.listWorkflows(repo);
    expect(workflows[0].name).toBe('CI');
  });

  it('exposes the budget and token expiration from the underlying client', async () => {
    const url =
      'https://api.github.com/repos/acme/api-core/actions/runs?per_page=100&exclude_pull_requests=true';
    const { fetchImpl } = fakeFetch({
      [url]: () =>
        jsonResponse(
          { total_count: 0, workflow_runs: [] },
          {
            'x-ratelimit-limit': '5000',
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': '1',
            'github-authentication-token-expiration': '2026-12-01',
          },
        ),
    });
    const reader = createGitHubReader({ token: 't', fetchImpl });
    expect(reader.getBudget()).toBeUndefined();
    await reader.listWorkflowRuns(repo);
    expect(reader.getBudget()?.remaining).toBe(4999);
    expect(reader.getTokenExpiration()).toBe('2026-12-01');
  });

  it('rejects a malformed payload with GitHubValidationError', async () => {
    const url =
      'https://api.github.com/repos/acme/api-core/actions/runs?per_page=100&exclude_pull_requests=true';
    const { fetchImpl } = fakeFetch({
      [url]: () => jsonResponse({ total_count: 0 }), // missing workflow_runs
    });
    const reader = createGitHubReader({ token: 't', fetchImpl });
    await expect(reader.listWorkflowRuns(repo)).rejects.toBeInstanceOf(
      GitHubValidationError,
    );
  });

  it('never leaks the token into a thrown error message', async () => {
    const url =
      'https://api.github.com/repos/acme/api-core/actions/runs?per_page=100&exclude_pull_requests=true';
    const { fetchImpl } = fakeFetch({
      [url]: () =>
        new Response(JSON.stringify({ message: 'Bad credentials' }), {
          status: 401,
        }),
    });
    const reader = createGitHubReader({
      token: 'super-secret-token',
      fetchImpl,
    });
    const err = await reader.listWorkflowRuns(repo).catch((e: unknown) => e);
    expect((err as Error).message).not.toContain('super-secret-token');
  });
});
