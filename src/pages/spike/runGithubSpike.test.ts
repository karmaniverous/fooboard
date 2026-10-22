/**
 * Tests for `runGithubSpike` against a fake `GitHubApi`: the ETag verdict
 * from the budget before/after the repeated request (sent with the first
 * response's ETag), compare head selection, and skipping jobs when there
 * are no runs.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import type { RateLimitBudget } from '@/lib/github/rateLimit';
import type { MatchingRef, WorkflowRun } from '@/lib/github/schemas';
import { fakeGitHubApi, fetched } from '@/test/fakeReaders';

import { runGithubSpike } from './runGithubSpike';

const budget = (remaining: number): RateLimitBudget => ({
  limit: 5000,
  remaining,
  reset: 0,
  used: 5000 - remaining,
  status: 'ok',
});

const run: WorkflowRun = {
  id: 7,
  name: 'CI',
  head_branch: 'main',
  head_sha: 'abc',
  status: 'completed',
  conclusion: 'success',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:05:00Z',
  html_url: '',
  workflow_id: 1,
  event: 'push',
};

/** A fake port plus handles on the spies the tests assert on. */
function fakeApi({
  runs = [run],
  refs = [{ ref: 'refs/heads/release/24.3', object: { sha: 'abc' } }],
  budgets = [budget(100), budget(100)],
}: {
  runs?: WorkflowRun[];
  refs?: MatchingRef[];
  budgets?: (RateLimitBudget | undefined)[];
} = {}) {
  const budgetSeen = vi.fn<() => RateLimitBudget | undefined>();
  for (const b of budgets) budgetSeen.mockReturnValueOnce(b);
  const runsPage = vi.fn(() =>
    Promise.resolve(fetched(runs, { etag: '"runs"' })),
  );
  const jobsPage = vi.fn(() =>
    Promise.resolve(
      fetched([
        {
          id: 1,
          run_id: 7,
          name: 'deploy',
          status: 'completed',
          conclusion: 'success',
          html_url: null,
        },
      ]),
    ),
  );
  const matchingRefs = vi.fn(() => Promise.resolve(refs));
  const compare = vi.fn(() =>
    Promise.resolve(
      fetched({ ahead_by: 2, behind_by: 1, html_url: '', commits: [] }),
    ),
  );
  const api = fakeGitHubApi({ runsPage, jobsPage, matchingRefs, compare });
  return { api, budgetSeen, runsPage, jobsPage, matchingRefs, compare };
}

const target = { owner: 'acme', repo: 'api-core' };
const repoRef = { owner: 'acme', repo: 'api-core' };

describe('runGithubSpike', () => {
  it.each([
    [
      'an unchanged budget means the 304 was honoured',
      [budget(100), budget(100)],
      true,
    ],
    ['a spent budget means it was not', [budget(100), budget(99)], false],
    ['no budget headers means unknown', [undefined, undefined], undefined],
  ])('%s', async (_label, budgets, expected) => {
    const { api, budgetSeen } = fakeApi({ budgets });
    const result = await runGithubSpike(api, budgetSeen, target);
    expect(result.notModifiedHonoured).toBe(expected);
  });

  it("repeats the runs request with the first response's ETag", async () => {
    const { api, budgetSeen, runsPage } = fakeApi();
    await runGithubSpike(api, budgetSeen, target);
    expect(runsPage).toHaveBeenLastCalledWith(repoRef, 1, '"runs"');
  });

  it('compares main against the first matching branch', async () => {
    const { api, budgetSeen, matchingRefs, compare } = fakeApi();
    const result = await runGithubSpike(api, budgetSeen, {
      ...target,
      branchPrefix: 'release/',
    });
    expect(matchingRefs).toHaveBeenCalledWith(repoRef, 'release/');
    expect(compare).toHaveBeenCalledWith(repoRef, 'main', 'release/24.3');
    expect(result.compare).toMatchObject({ aheadBy: 2, behindBy: 1 });
  });

  it('falls back to main...main with the main prefix when nothing matches', async () => {
    const { api, budgetSeen, matchingRefs, compare } = fakeApi({ refs: [] });
    await runGithubSpike(api, budgetSeen, { ...target, branchPrefix: '' });
    expect(matchingRefs).toHaveBeenCalledWith(repoRef, 'main');
    expect(compare).toHaveBeenCalledWith(repoRef, 'main', 'main');
  });

  it('skips the jobs call when there are no runs', async () => {
    const { api, budgetSeen, jobsPage } = fakeApi({ runs: [] });
    const result = await runGithubSpike(api, budgetSeen, target);
    expect(jobsPage).not.toHaveBeenCalled();
    expect(result.newestRunJobs).toEqual([]);
  });
});
