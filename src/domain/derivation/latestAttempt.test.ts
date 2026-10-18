/**
 * Tests for the latest-attempt rule (spec.md A§4.3.2): a re-run replaces
 * the earlier attempt's jobs.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { latestAttemptJobs } from './latestAttempt';
import { makeJob } from './testFixtures';

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
