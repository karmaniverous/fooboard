/**
 * Tests for empty-cell state resolution (spec.md §4.3.5): priority order
 * (needs-credential, error, no-branch, no-recent-runs) and rate limiting
 * explicitly not being an error.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { resolveEmptyState } from './emptyStates';

describe('resolveEmptyState', () => {
  it('reports needs-credential before any other state', () => {
    expect(
      resolveEmptyState({
        credentialStatus: 'expired',
        providerFailure: { message: 'boom', isRateLimit: false },
        branchExists: false,
        hasRelevantRun: false,
      }),
    ).toEqual({ kind: 'empty', state: 'needs-credential' });
  });

  it('reports error for a non-rate-limit provider failure', () => {
    expect(
      resolveEmptyState({
        credentialStatus: 'ok',
        providerFailure: {
          message: '500 Internal Server Error',
          isRateLimit: false,
        },
        branchExists: true,
        hasRelevantRun: true,
      }),
    ).toEqual({
      kind: 'empty',
      state: 'error',
      reason: '500 Internal Server Error',
    });
  });

  it('does not treat rate limiting as an error', () => {
    expect(
      resolveEmptyState({
        credentialStatus: 'ok',
        providerFailure: { message: 'rate limited', isRateLimit: true },
        branchExists: true,
        hasRelevantRun: true,
      }),
    ).toBeUndefined();
  });

  it('reports no-branch when the branch does not exist', () => {
    expect(
      resolveEmptyState({
        credentialStatus: 'ok',
        branchExists: false,
        hasRelevantRun: false,
      }),
    ).toEqual({ kind: 'empty', state: 'no-branch' });
  });

  it('reports no-recent-runs with the branch name when the branch exists but has no relevant run', () => {
    expect(
      resolveEmptyState({
        credentialStatus: 'ok',
        branchExists: true,
        branch: 'dev',
        hasRelevantRun: false,
      }),
    ).toEqual({ kind: 'empty', state: 'no-recent-runs', branch: 'dev' });
  });

  it('returns undefined when everything is fine (caller derives a normal status)', () => {
    expect(
      resolveEmptyState({
        credentialStatus: 'ok',
        branchExists: true,
        hasRelevantRun: true,
      }),
    ).toBeUndefined();
  });
});
