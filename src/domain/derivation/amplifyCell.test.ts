/**
 * Tests for Amplify cell derivation (spec.md §4.3.4): status mapping, the
 * newest job across sources and matching branches, and empty-state
 * fallbacks.
 *
 * @module
 */
import type { JobSummary } from '@aws-sdk/client-amplify';
import { describe, expect, it } from 'vitest';

import { deriveAmplifyCell, mapAmplifyStatus } from './amplifyCell';
import type { AmplifyJobWithBranch } from './types';

function job(overrides: Partial<JobSummary> = {}): JobSummary {
  return {
    jobId: '1',
    status: 'SUCCEED',
    commitId: 'abc123',
    startTime: new Date('2026-10-01T00:00:00Z'),
    endTime: new Date('2026-10-01T00:05:00Z'),
    ...overrides,
  } as JobSummary;
}

describe('mapAmplifyStatus', () => {
  it.each([
    ['PENDING', 'queued'],
    ['PROVISIONING', 'queued'],
    ['RUNNING', 'started'],
    ['SUCCEED', 'success'],
    ['FAILED', 'failure'],
    ['CANCELLED', 'cancelled'],
  ] as const)('maps %s to %s', (status, expected) => {
    expect(mapAmplifyStatus(status)).toBe(expected);
  });
});

const appA = { region: 'us-east-1', appId: 'appA' };
const appB = { region: 'eu-west-1', appId: 'appB' };

describe('deriveAmplifyCell', () => {
  it('picks the newest job across sources and links to that job', () => {
    const older: AmplifyJobWithBranch = {
      source: appA,
      branch: 'main',
      job: job({ jobId: 'a', startTime: new Date('2026-10-01T00:00:00Z') }),
    };
    const newer: AmplifyJobWithBranch = {
      source: appB,
      branch: 'release/24.3',
      job: job({
        jobId: 'b',
        startTime: new Date('2026-10-05T00:00:00Z'),
        commitId: 'def456',
      }),
    };
    const result = deriveAmplifyCell({
      jobsByBranch: [older, newer],
      branchExists: true,
      credentialStatus: 'ok',
    });
    expect(result).toMatchObject({
      kind: 'ok',
      branch: 'release/24.3',
      commit: 'def456',
      appId: 'appB',
      jobId: 'b',
      linkUrl:
        'https://eu-west-1.console.aws.amazon.com/amplify/apps/appB/branches/release%2F24.3/deployments/b',
    });
  });

  it('has no link when the winning job has no id', () => {
    const result = deriveAmplifyCell({
      jobsByBranch: [
        { source: appA, branch: 'main', job: job({ jobId: undefined }) },
      ],
      branchExists: true,
      credentialStatus: 'ok',
    });
    expect(result).toMatchObject({ kind: 'ok', linkUrl: undefined });
  });

  it('needs-credential takes priority over everything else', () => {
    const result = deriveAmplifyCell({
      jobsByBranch: [],
      branchExists: true,
      credentialStatus: 'expired',
    });
    expect(result).toEqual({ kind: 'empty', state: 'needs-credential' });
  });

  it('reports no-branch when no Amplify branch matches the stage pattern', () => {
    const result = deriveAmplifyCell({
      jobsByBranch: [],
      branchExists: false,
      credentialStatus: 'ok',
    });
    expect(result).toEqual({ kind: 'empty', state: 'no-branch' });
  });

  it('reports no-recent-runs when the branch exists but has no jobs', () => {
    const result = deriveAmplifyCell({
      jobsByBranch: [],
      branchExists: true,
      credentialStatus: 'ok',
    });
    expect(result).toEqual({ kind: 'empty', state: 'no-recent-runs' });
  });

  it('maps a failed job to Failure with its branch and commit', () => {
    const entry: AmplifyJobWithBranch = {
      source: appA,
      branch: 'main',
      job: job({ status: 'FAILED' }),
    };
    const result = deriveAmplifyCell({
      jobsByBranch: [entry],
      branchExists: true,
      credentialStatus: 'ok',
    });
    expect(result).toMatchObject({
      kind: 'ok',
      status: 'failure',
      phase: 'deploy',
    });
  });
});
