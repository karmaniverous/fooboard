/**
 * Tests for job-state mapping and the five status rules (spec.md §4.3.3):
 * approval waits, failure beating running, deploy-only success vs
 * deploy-done-test-pending partial success, cancelled and queued.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { RelevantJob } from './githubPhase';
import { deriveGithubCellStatus, finalPhase, jobState } from './githubStatus';
import { makeJob } from './testFixtures';

describe('jobState', () => {
  it('maps action_required (an approval wait) to queued', () => {
    expect(
      jobState(makeJob({ status: 'completed', conclusion: 'action_required' })),
    ).toBe('queued');
  });

  it.each([
    ['queued', null, 'queued'],
    ['waiting', null, 'queued'],
    ['pending', null, 'queued'],
    ['requested', null, 'queued'],
    ['in_progress', null, 'running'],
    ['completed', 'success', 'succeeded'],
    ['completed', 'failure', 'failed'],
    ['completed', 'timed_out', 'failed'],
    ['completed', 'startup_failure', 'failed'],
    ['completed', 'cancelled', 'cancelled'],
  ] as const)(
    'maps status=%s conclusion=%s to %s',
    (status, conclusion, expected) => {
      expect(jobState(makeJob({ status, conclusion }))).toBe(expected);
    },
  );
});

describe('finalPhase', () => {
  it('is test when any relevant job is a test job', () => {
    const jobs: RelevantJob[] = [
      { job: makeJob({ name: 'deploy' }), phase: 'deploy' },
      { job: makeJob({ name: 'test' }), phase: 'test' },
    ];
    expect(finalPhase(jobs)).toBe('test');
  });

  it('is deploy when no relevant job is a test job', () => {
    const jobs: RelevantJob[] = [
      { job: makeJob({ name: 'deploy' }), phase: 'deploy' },
    ];
    expect(finalPhase(jobs)).toBe('deploy');
  });
});

describe('deriveGithubCellStatus', () => {
  it('returns undefined for no relevant jobs', () => {
    expect(deriveGithubCellStatus([])).toBeUndefined();
  });

  it('failure beats a running job (rule 1 over rule 3)', () => {
    const jobs: RelevantJob[] = [
      {
        job: makeJob({
          id: 1,
          name: 'deploy',
          status: 'in_progress',
          conclusion: null,
        }),
        phase: 'deploy',
      },
      {
        job: makeJob({
          id: 2,
          name: 'test',
          status: 'completed',
          conclusion: 'failure',
        }),
        phase: 'test',
      },
    ];
    const result = deriveGithubCellStatus(jobs);
    expect(result?.status).toBe('failure');
    expect(result?.determiningJob.id).toBe(2);
  });

  it('cancelled beats running (rule 2 over rule 3)', () => {
    const jobs: RelevantJob[] = [
      {
        job: makeJob({ status: 'in_progress', conclusion: null }),
        phase: 'deploy',
      },
      {
        job: makeJob({ status: 'completed', conclusion: 'cancelled' }),
        phase: 'test',
      },
    ];
    expect(deriveGithubCellStatus(jobs)?.status).toBe('cancelled');
  });

  it('a running job beats a queued one (rule 3 over rule 5)', () => {
    const jobs: RelevantJob[] = [
      { job: makeJob({ status: 'queued', conclusion: null }), phase: 'deploy' },
      {
        job: makeJob({ status: 'in_progress', conclusion: null }),
        phase: 'test',
      },
    ];
    expect(deriveGithubCellStatus(jobs)?.status).toBe('started');
  });

  it('deploy-only success: a succeeded deploy job with no test job is Success', () => {
    const jobs: RelevantJob[] = [
      {
        job: makeJob({ name: 'deploy', conclusion: 'success' }),
        phase: 'deploy',
      },
    ];
    const result = deriveGithubCellStatus(jobs);
    expect(result?.status).toBe('success');
    expect(result?.phase).toBe('deploy');
  });

  it('deploy-done-test-pending: succeeded deploy with a still-queued test is Partial success', () => {
    const jobs: RelevantJob[] = [
      {
        job: makeJob({ id: 1, name: 'deploy', conclusion: 'success' }),
        phase: 'deploy',
      },
      {
        job: makeJob({
          id: 2,
          name: 'test',
          status: 'queued',
          conclusion: null,
        }),
        phase: 'test',
      },
    ];
    const result = deriveGithubCellStatus(jobs);
    expect(result?.status).toBe('partialSuccess');
    expect(result?.phase).toBe('test');
    expect(result?.determiningJob.id).toBe(1);
  });

  it('final-phase success: succeeded deploy and succeeded test is Success', () => {
    const jobs: RelevantJob[] = [
      {
        job: makeJob({ id: 1, name: 'deploy', conclusion: 'success' }),
        phase: 'deploy',
      },
      {
        job: makeJob({ id: 2, name: 'test', conclusion: 'success' }),
        phase: 'test',
      },
    ];
    const result = deriveGithubCellStatus(jobs);
    expect(result?.status).toBe('success');
    expect(result?.determiningJob.id).toBe(2);
  });

  it('breaks a finish-time tie between phases in favor of deploy (two failures)', () => {
    const jobs: RelevantJob[] = [
      {
        job: makeJob({
          name: 'test',
          conclusion: 'failure',
          completedAt: '2026-10-01T00:05:00Z',
        }),
        phase: 'test',
      },
      {
        job: makeJob({
          id: 2,
          name: 'deploy',
          conclusion: 'failure',
          completedAt: '2026-10-01T00:05:00Z',
        }),
        phase: 'deploy',
      },
    ];
    const result = deriveGithubCellStatus(jobs);
    expect(result?.determiningJob.id).toBe(2);
  });

  it('all jobs queued (an approval wait) yields Queued', () => {
    const jobs: RelevantJob[] = [
      {
        job: makeJob({ status: 'completed', conclusion: 'action_required' }),
        phase: 'deploy',
      },
    ];
    expect(deriveGithubCellStatus(jobs)?.status).toBe('queued');
  });
});
