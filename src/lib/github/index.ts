/**
 * Public surface of the GitHub adapter (spec.md §3.1), as the query layer
 * and board model consume it: the request port, the errors that become
 * cell states, the mapping into derivation inputs, and the budget type.
 *
 * @module
 */
export {
  type Conditional,
  createGitHubApi,
  type Fetched,
  GITHUB_PER_PAGE,
  type GitHubApi,
  pagesFor,
  repoRef,
} from './api';
export { RateLimitedError } from './errors';
export { mapRunWithJobs, mapWorkflowRun } from './mapToDerivation';
export { isOverPollingShare, type RateLimitBudget } from './rateLimit';
export {
  attemptOf,
  type Branch,
  type CompareApiResult,
  type Job,
  type Repo,
  type WorkflowRun,
} from './schemas';
