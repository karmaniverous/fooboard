/**
 * Typed fakes of the provider readers and GitHub fixture builders, so tests
 * supply only the methods and fields they use without type assertions. An
 * unfaked method rejects (or returns nothing), naming itself.
 *
 * @module
 */
import type { AmplifyReader } from '@/lib/amplify/reader';
import type { GitHubReader } from '@/lib/github';
import type { Branch, Repo } from '@/lib/github/schemas';

const notFaked = (name: string) => () =>
  Promise.reject(new Error(`${name} is not faked in this test`));

export const fakeGitHubReader = (
  methods: Partial<GitHubReader> = {},
): GitHubReader => ({
  listWorkflowRuns: notFaked('listWorkflowRuns'),
  listRunJobs: notFaked('listRunJobs'),
  matchingRefs: notFaked('matchingRefs'),
  compare: notFaked('compare'),
  listBranches: notFaked('listBranches'),
  listRepos: notFaked('listRepos'),
  getBudget: () => undefined,
  readRateLimit: notFaked('readRateLimit'),
  getTokenExpiration: () => undefined,
  ...methods,
});

export const fakeAmplifyReader = (
  methods: Partial<AmplifyReader> = {},
): AmplifyReader => ({
  listApps: notFaked('listApps'),
  listBranches: notFaked('listBranches'),
  listJobs: notFaked('listJobs'),
  getJob: notFaked('getJob'),
  ...methods,
});

/** A GitHub branch by name. */
export const ghBranch = (name: string, sha = '0'): Branch => ({
  name,
  commit: { sha },
});

/** A GitHub repo by `owner/name`. */
export const ghRepo = (fullName: string, isPrivate = false): Repo => {
  const [owner = '', name = ''] = fullName.split('/');
  return {
    full_name: fullName,
    name,
    private: isPrivate,
    html_url: `https://github.com/${fullName}`,
    owner: { login: owner },
  };
};
