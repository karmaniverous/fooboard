/**
 * Public surface of the GitHub adapter (spec.md §5): the `GitHubReader`
 * port, its `fetch`-based factory, typed errors and the rate-limit budget
 * type callers need to render "remaining budget" (spec.md C-16).
 *
 * Listed as a knip `entry` point: these exports are the adapter's contract
 * with the UI, which does not exist yet in this slice.
 *
 * @module
 */
export {
  GitHubAuthError,
  GitHubForbiddenError,
  GitHubHttpError,
  GitHubNetworkError,
  GitHubNotFoundError,
  GitHubReaderError,
  GitHubValidationError,
  isNeedsCredential,
  RateLimitedError,
} from './errors';
export {
  DEFAULT_LOW_BUDGET_THRESHOLD,
  type RateLimitBudget,
} from './rateLimit';
export {
  type CompareResult,
  createGitHubReader,
  type GitHubReader,
  type GitHubReaderConfig,
  type RepoRef,
} from './reader';
export type {
  Branch,
  Job,
  MatchingRef,
  Repo,
  Workflow,
  WorkflowRun,
} from './schemas';
