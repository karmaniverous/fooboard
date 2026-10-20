/**
 * Tests for reading workflow runs in pages: up to the pages asked for,
 * stopping at a short page.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { createGitHubReader } from './reader';
import { fakeFetch, jsonResponse } from './testFetch';

const repo = { owner: 'acme', repo: 'api-core' };

describe('listWorkflowRuns pages', () => {
  it('listWorkflowRuns reads up to the pages asked for, stopping at a short page', async () => {
    const page = (n: number) =>
      `https://api.github.com/repos/acme/api-core/actions/runs?per_page=2&page=${String(n)}&exclude_pull_requests=true`;
    const run = (id: number) => ({
      id,
      name: 'CI',
      head_branch: 'main',
      head_sha: 'abc',
      status: 'completed',
      conclusion: 'success',
      created_at: '2026-10-16T00:00:00Z',
      updated_at: '2026-10-16T00:01:00Z',
      html_url: `https://github.com/acme/api-core/actions/runs/${String(id)}`,
      workflow_id: 10,
      event: 'push',
    });
    const body = (ids: number[]) => () =>
      jsonResponse({ total_count: 5, workflow_runs: ids.map(run) });
    const { fetchImpl, calls } = fakeFetch({
      [page(1)]: body([1, 2]),
      [page(2)]: body([3]),
      [page(3)]: body([4, 5]),
    });
    const reader = createGitHubReader({ token: 't', fetchImpl });
    const runs = await reader.listWorkflowRuns(repo, { perPage: 2, pages: 3 });
    expect(runs.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(calls).toEqual([page(1), page(2)]);
  });
});
