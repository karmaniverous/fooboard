/**
 * Tests for `newestJob`: latest start time wins, missing start times sort
 * last, empty input yields `undefined`.
 *
 * @module
 */
import type { JobSummary } from '@aws-sdk/client-amplify';
import { describe, expect, it } from 'vitest';

import { amplifyJobSummary } from '@/lib/amplify/sdkShapes';

import { newestJob } from './newestJob';

const job = (jobId: string, startTime?: string): JobSummary =>
  amplifyJobSummary({
    jobId,
    startTime: startTime ? new Date(startTime) : undefined,
  });

describe('newestJob', () => {
  it('returns undefined for no jobs', () => {
    expect(newestJob([])).toBeUndefined();
  });

  it('picks the latest start time regardless of order', () => {
    const jobs = [
      job('1', '2026-10-01T00:00:00Z'),
      job('3', '2026-10-15T00:00:00Z'),
      job('2', '2026-10-08T00:00:00Z'),
    ];
    expect(newestJob(jobs)?.jobId).toBe('3');
  });

  it('sorts jobs without a start time last', () => {
    expect(newestJob([job('x'), job('1', '2026-10-01T00:00:00Z')])?.jobId).toBe(
      '1',
    );
  });
});
