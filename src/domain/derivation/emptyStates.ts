/**
 * Empty-cell states (spec.md §4.3.5): no branch, no recent runs, needs
 * credential, error. Rate limiting is explicitly **not** an error. Shared
 * shape for GitHub and Amplify cells. Pure; no network.
 *
 * @module
 */

/** Credential status for a row, as resolved by the credential store
 * (built later; passed in here as a plain value). */
export type CredentialStatus = 'ok' | 'missing' | 'expired';

/** A provider-call failure, distinguished from rate limiting, which is not
 * an error state (spec.md §4.3.5). */
export interface ProviderFailure {
  message: string;
  isRateLimit: boolean;
}

export type EmptyCellState =
  'no-branch' | 'no-recent-runs' | 'needs-credential' | 'error';

/** An empty cell result, with the branch name when it is known. */
export interface EmptyCellResult {
  kind: 'empty';
  state: EmptyCellState;
  /** The matched branch name, when the empty state still knows one
   * (`no-recent-runs`), or `undefined` (`no-branch`, `needs-credential`,
   * most `error` cases). */
  branch?: string;
  /** Short failure reason, for `error` only. */
  reason?: string;
}

/**
 * Resolve the empty-cell state from credential status, provider failure and
 * branch existence, in priority order: needs-credential, then error
 * (excluding rate limiting), then no-branch, then no-recent-runs. Returns
 * `undefined` when none apply, meaning the caller should derive a normal
 * status instead.
 */
export function resolveEmptyState(input: {
  credentialStatus: CredentialStatus;
  providerFailure?: ProviderFailure;
  branchExists: boolean;
  branch?: string;
  hasRelevantRun: boolean;
}): EmptyCellResult | undefined {
  if (input.credentialStatus !== 'ok') {
    return { kind: 'empty', state: 'needs-credential' };
  }
  if (input.providerFailure && !input.providerFailure.isRateLimit) {
    return {
      kind: 'empty',
      state: 'error',
      reason: input.providerFailure.message,
    };
  }
  if (!input.branchExists) {
    return { kind: 'empty', state: 'no-branch' };
  }
  if (!input.hasRelevantRun) {
    return { kind: 'empty', state: 'no-recent-runs', branch: input.branch };
  }
  return undefined;
}
