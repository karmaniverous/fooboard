/**
 * Tests for the normalised documents: a GitHub run's document holds only
 * the latest attempt's jobs the row sees, without skipped, neutral or stale
 * jobs, and is absent when the row sees none; an Amplify job's document
 * carries its status and times as strings.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { GithubWorkflowJob } from '@/domain/derivation/types';
import { amplifyJobSummary } from '@/lib/amplify/sdkShapes';

import { amplifyJobDocument, githubRunDocument } from './documents';

const run = {
  id: 1,
  workflowName: 'Deploy',
  headBranch: 'main',
  headSha: 'abc',
  createdAt: '2026-10-01T00:00:00Z',
  event: 'push',
  htmlUrl: '',
};

const job = (
  name: string,
  runAttempt: number,
  conclusion: GithubWorkflowJob['conclusion'] = 'success',
): GithubWorkflowJob => ({
  id: runAttempt,
  runId: 1,
  runAttempt,
  name,
  status: 'completed',
  conclusion,
  startedAt: null,
  completedAt: null,
  htmlUrl: '',
});

describe('githubRunDocument', () => {
  it("keeps the latest attempt's jobs the row sees, minus ignored ones", () => {
    const doc = githubRunDocument(
      {
        run,
        jobs: [
          job('deploy (billing)', 1, 'failure'),
          job('deploy (billing)', 2),
          job('deploy (orders)', 2),
          job('lint (billing)', 2, 'skipped'),
        ],
      },
      [{ field: 'jobName', operator: 'contains', value: 'billing' }],
    );
    expect(doc).toEqual({
      workflow: 'Deploy',
      event: 'push',
      branch: 'main',
      attempt: 2,
      jobs: [
        {
          name: 'deploy (billing)',
          status: 'completed',
          conclusion: 'success',
          startedAt: null,
          completedAt: null,
        },
      ],
    });
  });

  it('is absent when the row sees none of the run', () => {
    expect(
      githubRunDocument({ run, jobs: [job('deploy (orders)', 1)] }, [
        { field: 'jobName', operator: 'contains', value: 'billing' },
      ]),
    ).toBeUndefined();
  });
});

describe('githubRunDocument with a job test', () => {
  const deployJobs = {
    type: 'object',
    properties: { name: { pattern: '[dD]eploy' } },
  };

  it('keeps only the jobs the status set cares about', () => {
    const doc = githubRunDocument(
      { run, jobs: [job('deploy', 1), job('lint', 1, 'failure')] },
      [],
      deployJobs,
    );
    expect(doc?.jobs.map((j) => j.name)).toEqual(['deploy']);
  });

  it("is absent for a run without them, so it isn't the cell's", () => {
    expect(
      githubRunDocument({ run, jobs: [job('CodeQL', 1)] }, [], deployJobs),
    ).toBeUndefined();
  });
});
describe('amplifyJobDocument', () => {
  it('carries the status, commit and times', () => {
    expect(
      amplifyJobDocument({
        source: { region: 'us-east-1', appId: 'd1' },
        branch: 'main',
        job: amplifyJobSummary({
          status: 'RUNNING',
          commitId: 'abc',
          startTime: new Date('2026-10-01T00:00:00Z'),
        }),
      }),
    ).toEqual({
      branch: 'main',
      status: 'RUNNING',
      commitId: 'abc',
      startTime: '2026-10-01T00:00:00.000Z',
      endTime: null,
    });
  });
});
