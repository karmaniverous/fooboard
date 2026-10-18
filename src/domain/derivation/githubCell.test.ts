/**
 * Tests for the GitHub cell combinator (spec.md §4.3.2-§4.3.5): picks the
 * newest candidate run with at least one relevant job (skipping runs with
 * none), falls back to empty states, and a re-run updates the cell in
 * place via the latest attempt.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { GithubCellDerivation, GithubCellResult } from './githubCell';
import { deriveGithubCell } from './githubCell';
import { defaultMapping, githubSet, makeJob, makeRun } from './testFixtures';
import type { GithubRunWithJobs } from './types';

function entry(
  run: ReturnType<typeof makeRun>,
  jobs: ReturnType<typeof makeJob>[],
): GithubRunWithJobs {
  return { run, jobs };
}

/** Narrow a derivation result to its `ok` branch, failing fast (not via a
 * conditional `expect`) when it isn't. */
function assertOk(
  result: GithubCellDerivation,
): asserts result is GithubCellResult {
  if (result.kind !== 'ok') {
    throw new Error(`expected an ok cell, got ${result.state}`);
  }
}

describe('deriveGithubCell', () => {
  it('needs-credential takes priority over everything else', () => {
    const result = deriveGithubCell({
      runs: [],
      mapping: defaultMapping,
      set: githubSet,
      branchPattern: 'main',
      rowKeyTests: [],
      branchExists: true,
      credentialStatus: 'missing',
    });
    expect(result).toEqual({ kind: 'empty', state: 'needs-credential' });
  });

  it('reports no-branch when the stage branch does not exist', () => {
    const result = deriveGithubCell({
      runs: [],
      mapping: defaultMapping,
      set: githubSet,
      branchPattern: 'main',
      rowKeyTests: [],
      branchExists: false,
      credentialStatus: 'ok',
    });
    expect(result).toEqual({ kind: 'empty', state: 'no-branch' });
  });

  it('reports no-recent-runs when the branch exists but no run has a relevant job', () => {
    const irrelevant = entry(makeRun({ headBranch: 'main' }), [
      makeJob({ name: 'lint', conclusion: 'success' }),
    ]);
    const result = deriveGithubCell({
      runs: [irrelevant],
      mapping: defaultMapping,
      set: githubSet,
      branchPattern: 'main',
      rowKeyTests: [],
      branchExists: true,
      credentialStatus: 'ok',
    });
    expect(result).toEqual({ kind: 'empty', state: 'no-recent-runs' });
  });

  it('skips a newer run with no relevant jobs and uses the next newest that has one', () => {
    const newerButIrrelevant = entry(
      makeRun({ headBranch: 'main', createdAt: '2026-10-05T00:00:00Z' }),
      [makeJob({ name: 'lint', conclusion: 'success' })],
    );
    const olderButRelevant = entry(
      makeRun({
        headBranch: 'main',
        createdAt: '2026-10-01T00:00:00Z',
        headSha: 'abc123',
      }),
      [makeJob({ name: 'deploy', conclusion: 'success' })],
    );
    const result = deriveGithubCell({
      runs: [newerButIrrelevant, olderButRelevant],
      mapping: defaultMapping,
      set: githubSet,
      branchPattern: 'main',
      rowKeyTests: [],
      branchExists: true,
      credentialStatus: 'ok',
    });
    assertOk(result);
    expect(result.commit).toBe('abc123');
    expect(result.status.id).toBe('deployed');
  });

  it('a re-run (higher runAttempt) updates the cell in place', () => {
    const run = makeRun({ headBranch: 'main' });
    const reRun = entry(run, [
      makeJob({
        runId: run.id,
        runAttempt: 1,
        name: 'deploy',
        conclusion: 'failure',
      }),
      makeJob({
        runId: run.id,
        runAttempt: 2,
        name: 'deploy',
        conclusion: 'success',
      }),
    ]);
    const result = deriveGithubCell({
      runs: [reRun],
      mapping: defaultMapping,
      set: githubSet,
      branchPattern: 'main',
      rowKeyTests: [],
      branchExists: true,
      credentialStatus: 'ok',
    });
    assertOk(result);
    expect(result.status.id).toBe('deployed');
  });

  it('derives a full ok result with branch, commit, time and link from the determining job', () => {
    const run = makeRun({ headBranch: 'release/24.3', headSha: 'deadbeef' });
    const job = makeJob({
      name: 'deploy',
      conclusion: 'success',
      completedAt: '2026-10-01T00:05:00Z',
      htmlUrl: 'https://github.com/acme/api-core/actions/runs/1/job/9',
    });
    const result = deriveGithubCell({
      runs: [entry(run, [job])],
      mapping: defaultMapping,
      set: githubSet,
      branchPattern: 'release/**',
      rowKeyTests: [],
      branchExists: true,
      credentialStatus: 'ok',
    });
    expect(result).toMatchObject({
      kind: 'ok',
      status: { id: 'deployed', name: 'Deployed' },
      branch: 'release/24.3',
      commit: 'deadbeef',
      time: '2026-10-01T00:05:00Z',
      linkUrl: 'https://github.com/acme/api-core/actions/runs/1/job/9',
      document: { branch: 'release/24.3' },
    });
  });

  it('shows Unknown for a relevant run that matches no status', () => {
    const narrow = { ...githubSet, cell: githubSet.cell.slice(0, 1) };
    const result = deriveGithubCell({
      runs: [entry(makeRun({ headBranch: 'main' }), [makeJob()])],
      mapping: defaultMapping,
      set: narrow,
      branchPattern: 'main',
      rowKeyTests: [],
      branchExists: true,
      credentialStatus: 'ok',
    });
    assertOk(result);
    expect(result.status.id).toBe('unknown');
    expect(result.status.summary.id).toBe('unknown');
  });

  it('takes time and link from a running job before the latest finished one', () => {
    const run = makeRun({ headBranch: 'main' });
    const result = deriveGithubCell({
      runs: [
        entry(run, [
          makeJob({ name: 'deploy', completedAt: '2026-10-01T00:09:00Z' }),
          makeJob({
            name: 'test',
            status: 'in_progress',
            conclusion: null,
            startedAt: '2026-10-01T00:03:00Z',
            completedAt: null,
            htmlUrl: 'running-job',
          }),
        ]),
      ],
      mapping: defaultMapping,
      set: githubSet,
      branchPattern: 'main',
      rowKeyTests: [],
      branchExists: true,
      credentialStatus: 'ok',
    });
    assertOk(result);
    expect(result.status.id).toBe('testing');
    expect(result.status.summary.inProgress).toBe(true);
    expect(result).toMatchObject({
      time: '2026-10-01T00:03:00Z',
      linkUrl: 'running-job',
    });
  });
});
