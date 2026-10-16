/**
 * Tests for phase classification and relevant-job selection (spec.md
 * §4.3.1-§4.3.2): latest attempt only, phase tests, row key tests,
 * ignored conclusions, reusable-workflow and matrix job names.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { jobPhase, latestAttemptJobs, relevantJobs } from './githubPhase';
import { defaultMapping, makeJob } from './testFixtures';

describe('latestAttemptJobs', () => {
  it('returns only jobs from the highest runAttempt (a re-run)', () => {
    const jobs = [
      makeJob({ id: 1, runAttempt: 1, name: 'deploy', conclusion: 'failure' }),
      makeJob({ id: 2, runAttempt: 2, name: 'deploy', conclusion: 'success' }),
    ];
    expect(latestAttemptJobs(jobs)).toEqual([jobs[1]]);
  });

  it('returns an empty array for no jobs', () => {
    expect(latestAttemptJobs([])).toEqual([]);
  });
});

describe('jobPhase', () => {
  it('matches a reusable-workflow job name ("deploy / deploy")', () => {
    const job = makeJob({ name: 'deploy / deploy' });
    expect(jobPhase(job, defaultMapping.phases)).toBe('deploy');
  });

  it('matches a matrix job name ("deploy (billing)")', () => {
    const job = makeJob({ name: 'deploy (billing)' });
    expect(jobPhase(job, defaultMapping.phases)).toBe('deploy');
  });

  it('counts a job matching both phase tests as test', () => {
    const job = makeJob({ name: 'deploy-and-test' });
    expect(jobPhase(job, defaultMapping.phases)).toBe('test');
  });

  it('returns undefined for a job matching neither phase', () => {
    const job = makeJob({ name: 'lint' });
    expect(jobPhase(job, defaultMapping.phases)).toBeUndefined();
  });
});

describe('relevantJobs', () => {
  it('ignores skipped, neutral and stale conclusions', () => {
    const jobs = [
      makeJob({ id: 1, name: 'deploy', conclusion: 'skipped' }),
      makeJob({ id: 2, name: 'deploy', conclusion: 'neutral' }),
      makeJob({ id: 3, name: 'deploy', conclusion: 'stale' }),
      makeJob({ id: 4, name: 'deploy', conclusion: 'success' }),
    ];
    const result = relevantJobs(jobs, 'CI', defaultMapping.phases, []);
    expect(result).toHaveLength(1);
    expect(result[0]?.job.id).toBe(4);
  });

  it("a key-less row sees all phase-matching jobs, including other rows' keyed jobs", () => {
    const jobs = [
      makeJob({ name: 'deploy (billing)' }),
      makeJob({ name: 'deploy (invoicing)' }),
    ];
    const result = relevantJobs(jobs, 'CI', defaultMapping.phases, []);
    expect(result).toHaveLength(2);
  });

  it('a keyed row only sees jobs matching its row key test (matrix job)', () => {
    const jobs = [
      makeJob({ name: 'deploy (billing)' }),
      makeJob({ name: 'deploy (invoicing)' }),
    ];
    const rowKeyTests = [
      {
        field: 'jobName' as const,
        operator: 'contains' as const,
        value: 'billing',
      },
    ];
    const result = relevantJobs(jobs, 'CI', defaultMapping.phases, rowKeyTests);
    expect(result).toHaveLength(1);
    expect(result[0]?.job.name).toBe('deploy (billing)');
  });

  it('only considers jobs from the latest attempt (a re-run)', () => {
    const jobs = [
      makeJob({ id: 1, runAttempt: 1, name: 'deploy', conclusion: 'failure' }),
      makeJob({ id: 2, runAttempt: 2, name: 'deploy', conclusion: 'success' }),
    ];
    const result = relevantJobs(jobs, 'CI', defaultMapping.phases, []);
    expect(result).toHaveLength(1);
    expect(result[0]?.job.id).toBe(2);
  });
});
