/**
 * Tests for `runGithubSpike` against a fake `GitHubReader`: the ETag verdict
 * from budget before/after the repeated request, compare head selection,
 * and skipping jobs when there are no runs.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import type { RateLimitBudget } from '@/lib/github/rateLimit';
import type { GitHubReader } from '@/lib/github/reader';

import { runGithubSpike } from './runGithubSpike';

const budget = (remaining: number): RateLimitBudget => ({
  limit: 5000,
  remaining,
  reset: 0,
  used: 5000 - remaining,
  status: 'ok',
});

const run = {
  id: 7,
  name: 'CI',
  head_branch: 'main',
  status: 'completed',
  conclusion: 'success',
};

/** A fake reader plus handles on the spies the tests assert on. */
function fakeReader({
  runs = [run],
  refs = [{ ref: 'refs/heads/release/24.3' }],
  budgets = [budget(100), budget(100)],
}: {
  runs?: unknown[];
  refs?: { ref: string }[];
  budgets?: (RateLimitBudget | undefined)[];
} = {}) {
  const getBudget = vi.fn();
  for (const b of budgets) getBudget.mockReturnValueOnce(b);
  const listRunJobs = vi.fn(() =>
    Promise.resolve([
      { name: 'deploy', status: 'completed', conclusion: 'success' },
    ]),
  );
  const matchingRefs = vi.fn(() => Promise.resolve(refs));
  const compare = vi.fn(() =>
    Promise.resolve({
      aheadBy: 2,
      behindBy: 1,
      htmlUrl: '',
      aheadCommitSubjects: [],
      behindCommitSubjects: [],
    }),
  );
  const reader = {
    listWorkflowRuns: vi.fn(() => Promise.resolve(runs)),
    listRunJobs,
    listWorkflows: vi.fn(),
    matchingRefs,
    compare,
    listBranches: vi.fn(),
    listRepos: vi.fn(),
    getBudget,
    getTokenExpiration: vi.fn(() => undefined),
  } as unknown as GitHubReader;
  return { reader, listRunJobs, matchingRefs, compare };
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
    const { reader } = fakeReader({ budgets });
    const result = await runGithubSpike(reader, target);
    expect(result.notModifiedHonoured).toBe(expected);
  });

  it('compares main against the first matching branch', async () => {
    const { reader, matchingRefs, compare } = fakeReader();
    const result = await runGithubSpike(reader, {
      ...target,
      branchPrefix: 'release/',
    });
    expect(matchingRefs).toHaveBeenCalledWith(repoRef, 'release/');
    expect(compare).toHaveBeenCalledWith(repoRef, 'main', 'release/24.3');
    expect(result.compare).toMatchObject({ aheadBy: 2, behindBy: 1 });
  });

  it('falls back to main...main with the main prefix when nothing matches', async () => {
    const { reader, matchingRefs, compare } = fakeReader({ refs: [] });
    await runGithubSpike(reader, { ...target, branchPrefix: '' });
    expect(matchingRefs).toHaveBeenCalledWith(repoRef, 'main');
    expect(compare).toHaveBeenCalledWith(repoRef, 'main', 'main');
  });

  it('skips the jobs call when there are no runs', async () => {
    const { reader, listRunJobs } = fakeReader({ runs: [] });
    const result = await runGithubSpike(reader, target);
    expect(listRunJobs).not.toHaveBeenCalled();
    expect(result.newestRunJobs).toEqual([]);
  });
});
