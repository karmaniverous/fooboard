/**
 * Public surface of the GitHub adapter (spec.md §5), as the board engine
 * consumes it: the reader port, the errors the engine turns into cell
 * states, the mapping into derivation inputs, and the budget and compare
 * types. Exports are added here as callers need them.
 *
 * @module
 */
export { GitHubAuthError, RateLimitedError } from './errors';
export { mapRunWithJobs, mapWorkflowRun } from './mapToDerivation';
export { isOverPollingShare, type RateLimitBudget } from './rateLimit';
export type { CompareResult, GitHubReader } from './reader';
export type { WorkflowRun } from './schemas';
