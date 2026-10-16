/**
 * Tests for `mapToDerivation`: REST shapes map to the small derivation
 * input types (spec.md §4.3) with the right defensive fallbacks for
 * unrecognized job statuses/conclusions, and `mapRunWithJobs` wires a run's
 * `id` onto each of its jobs.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  mapRunWithJobs,
  mapWorkflowJob,
  mapWorkflowRun,
} from './mapToDerivation';
import type { Job, WorkflowRun } from './schemas';

const baseRun: WorkflowRun = {
  id: 1,
  name: 'CI',
  head_branch: 'main',
  head_sha: 'abc123',
  status: 'completed',
  conclusion: 'success',
  created_at: '2026-10-16T00:00:00Z',
  updated_at: '2026-10-16T00:01:00Z',
  run_attempt: 1,
  html_url: 'https://github.com/acme/api-core/actions/runs/1',
  workflow_id: 10,
  event: 'push',
};

const baseJob: Job = {
  id: 5,
  run_id: 1,
  name: 'deploy',
  status: 'completed',
  conclusion: 'success',
  started_at: '2026-10-16T00:00:00Z',
  completed_at: '2026-10-16T00:01:00Z',
  html_url: 'https://github.com/acme/api-core/actions/runs/1/jobs/5',
  run_attempt: 1,
};

describe('mapWorkflowRun', () => {
  it('maps the fields derivation needs, including the triggering event', () => {
    expect(mapWorkflowRun(baseRun)).toEqual({
      id: 1,
      workflowName: 'CI',
      headBranch: 'main',
      headSha: 'abc123',
      createdAt: '2026-10-16T00:00:00Z',
      event: 'push',
      htmlUrl: 'https://github.com/acme/api-core/actions/runs/1',
    });
  });

  it('falls back to an empty workflow name when GitHub omits it', () => {
    expect(mapWorkflowRun({ ...baseRun, name: null }).workflowName).toBe('');
  });
});

describe('mapWorkflowJob', () => {
  it('maps a known status and conclusion verbatim', () => {
    const mapped = mapWorkflowJob(baseJob);
    expect(mapped.status).toBe('completed');
    expect(mapped.conclusion).toBe('success');
    expect(mapped.htmlUrl).toBe(baseJob.html_url);
  });

  it('defaults an unrecognized status to queued rather than throwing', () => {
    expect(mapWorkflowJob({ ...baseJob, status: 'future_status' }).status).toBe(
      'queued',
    );
  });

  it('maps an unrecognized conclusion to null', () => {
    expect(
      mapWorkflowJob({ ...baseJob, conclusion: 'future_conclusion' })
        .conclusion,
    ).toBeNull();
  });

  it('keeps a null conclusion as null', () => {
    expect(
      mapWorkflowJob({ ...baseJob, conclusion: null }).conclusion,
    ).toBeNull();
  });

  it('falls back to an empty link when GitHub omits html_url', () => {
    expect(mapWorkflowJob({ ...baseJob, html_url: null }).htmlUrl).toBe('');
  });
});

describe('mapRunWithJobs', () => {
  it('combines a run and its jobs, keeping each job run id', () => {
    const result = mapRunWithJobs(baseRun, [baseJob, { ...baseJob, id: 6 }]);
    expect(result.run.id).toBe(1);
    expect(result.jobs.map((j) => j.runId)).toEqual([1, 1]);
    expect(result.jobs.map((j) => j.id)).toEqual([5, 6]);
  });
});
