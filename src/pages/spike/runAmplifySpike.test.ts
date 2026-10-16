/**
 * Tests for `runAmplifySpike` against a fake `AmplifyReader`: branch
 * defaulting, newest-job selection, console link, and both error paths.
 *
 * @module
 */
import type { Branch, Job, JobSummary } from '@aws-sdk/client-amplify';
import { describe, expect, it, vi } from 'vitest';

import type { AmplifyReader } from '@/lib/amplify/reader';

import { runAmplifySpike } from './runAmplifySpike';

const branch = (branchName: string): Branch => ({ branchName }) as Branch;
const summary = (jobId: string, startTime: string): JobSummary =>
  ({ jobId, startTime: new Date(startTime) }) as JobSummary;

/** A fake reader plus a handle on its `getJob` spy for assertions. */
function fakeReader(
  branches: Branch[],
  jobs: JobSummary[],
): { reader: AmplifyReader; getJob: ReturnType<typeof vi.fn> } {
  const getJob = vi.fn((_app: string, _branch: string, jobId: string) =>
    Promise.resolve({ summary: { jobId } } as Job),
  );
  return {
    reader: {
      listBranches: vi.fn(() => Promise.resolve(branches)),
      listJobs: vi.fn(() => Promise.resolve(jobs)),
      getJob,
    },
    getJob,
  };
}

const target = { region: 'us-east-1', appId: 'app1' };

describe('runAmplifySpike', () => {
  it('defaults to the first branch and fetches the newest job', async () => {
    const { reader, getJob } = fakeReader(
      [branch('dev'), branch('preview/bali')],
      [
        summary('7', '2026-10-01T00:00:00Z'),
        summary('9', '2026-10-15T00:00:00Z'),
      ],
    );

    const result = await runAmplifySpike(reader, target);

    expect(getJob).toHaveBeenCalledWith('app1', 'dev', '9');
    expect(result.consoleLink).toBe(
      'https://us-east-1.console.aws.amazon.com/amplify/apps/app1/branches/dev/deployments/9',
    );
  });

  it('uses the given branch, treating blank as omitted', async () => {
    const { reader, getJob } = fakeReader(
      [branch('dev')],
      [summary('1', '2026-10-01T00:00:00Z')],
    );

    await runAmplifySpike(reader, { ...target, branch: 'preview/bali' });
    expect(getJob).toHaveBeenLastCalledWith('app1', 'preview/bali', '1');

    await runAmplifySpike(reader, { ...target, branch: '' });
    expect(getJob).toHaveBeenLastCalledWith('app1', 'dev', '1');
  });

  it('fails clearly when the app has no branches', async () => {
    await expect(
      runAmplifySpike(fakeReader([], []).reader, target),
    ).rejects.toThrow('No branch found');
  });

  it('fails clearly when the branch has no jobs', async () => {
    await expect(
      runAmplifySpike(fakeReader([branch('dev')], []).reader, target),
    ).rejects.toThrow('No jobs found on branch "dev"');
  });
});
