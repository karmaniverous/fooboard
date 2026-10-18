/**
 * Tests for the bundled presets: *GitHub deploy and test* gives every run
 * the same status as today's rules (A§4.3.3), checked exhaustively over
 * runs of up to two jobs; the single-job and Amplify sets cover their
 * statuses; every preset is a valid set.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { PhaseTestsSchema } from '@/domain/config/legacyV2';
import type {
  GithubJobConclusion,
  GithubJobStatus,
  GithubWorkflowJob,
} from '@/domain/derivation/types';
import {
  type CellStatus as LegacyStatus,
  deriveGithubCellStatus,
  relevantJobs,
} from '@/test/legacyStatusRules';

import { classify } from './classify';
import { githubRunDocument } from './documents';
import { PRESETS } from './presets';
import { findStatusSet } from './resolve';

/** Today's status for each deploy-and-test status. */
const LEGACY: Record<string, LegacyStatus> = {
  testFailed: 'failure',
  deployFailed: 'failure',
  cancelled: 'cancelled',
  testing: 'started',
  deploying: 'started',
  passed: 'success',
  deployed: 'success',
  partial: 'partialSuccess',
  queued: 'queued',
};

const NAMES = ['Deploy prod', 'unit test', 'deploy-tests', 'build'];
const STATES: [GithubJobStatus, GithubJobConclusion][] = [
  ['queued', null],
  ['waiting', null],
  ['in_progress', null],
  ['completed', 'success'],
  ['completed', 'failure'],
  ['completed', 'timed_out'],
  ['completed', 'cancelled'],
  ['completed', 'action_required'],
];

const job = (
  i: number,
  name: string,
  [status, conclusion]: [GithubJobStatus, GithubJobConclusion],
): GithubWorkflowJob => ({
  id: i,
  runId: 1,
  runAttempt: 1,
  name,
  status,
  conclusion,
  startedAt: '2026-10-01T00:00:00Z',
  completedAt: conclusion ? `2026-10-01T00:0${String(i)}:00Z` : null,
  htmlUrl: '',
});

const singles = NAMES.flatMap((n) => STATES.map((s) => job(1, n, s)));
const runs = [
  ...singles.map((j) => [j]),
  ...singles.flatMap((a) => singles.map((b) => [a, { ...b, id: 2 }])),
];

const run = {
  id: 1,
  workflowName: 'CI',
  headBranch: 'main',
  headSha: 'abc',
  createdAt: '2026-10-01T00:00:00Z',
  event: 'push',
  htmlUrl: '',
};

const docOf = (jobs: GithubWorkflowJob[]) => ({
  workflow: 'CI',
  event: 'push',
  branch: 'main',
  attempt: 1,
  jobs: jobs.map(({ name, status, conclusion, startedAt, completedAt }) => ({
    name,
    status,
    conclusion,
    startedAt,
    completedAt,
  })),
});

const PHASES = PhaseTestsSchema.parse({});

describe('GitHub deploy and test', () => {
  const set = findStatusSet('github-deploy-test');

  it(`agrees with today's rules on all ${String(runs.length)} runs`, () => {
    if (!set) throw new Error('missing preset');
    const disagreements = runs.flatMap((jobs) => {
      const legacy = deriveGithubCellStatus(
        relevantJobs(jobs, 'CI', PHASES, []),
      )?.status;
      // Through the real path: runs without deploy or test jobs have no
      // document (skipped, as today's rules give no status).
      const doc = githubRunDocument({ run, jobs }, [], set.jobs);
      const found = doc && classify(doc, set);
      const now = found && LEGACY[found.id];
      return now === legacy
        ? []
        : [
            `${jobs.map((j) => `${j.name}:${j.status}/${String(j.conclusion)}`).join(', ')} -> ${String(now)}, was ${String(legacy)}`,
          ];
    });
    expect(disagreements).toEqual([]);
  });
});

describe('GitHub single job', () => {
  it.each([
    [
      [
        ['completed', 'success'],
        ['completed', 'failure'],
      ],
      'failed',
    ],
    [
      [
        ['completed', 'success'],
        ['in_progress', null],
      ],
      'running',
    ],
    [
      [
        ['completed', 'success'],
        ['completed', 'action_required'],
      ],
      'queued',
    ],
    [
      [
        ['completed', 'success'],
        ['completed', 'success'],
      ],
      'succeeded',
    ],
  ] satisfies [[GithubJobStatus, GithubJobConclusion][], string][])(
    'classifies %j as %s',
    (states, expected) => {
      const set = findStatusSet('github-single-job');
      if (!set) throw new Error('missing preset');
      const jobs = states.map((s, i) => job(i, 'job', s));
      expect(classify(docOf(jobs), set)?.id).toBe(expected);
    },
  );
});

describe('Amplify', () => {
  it.each([
    ['FAILED', 'failed'],
    ['CANCELLING', 'cancelled'],
    ['RUNNING', 'running'],
    ['PROVISIONING', 'queued'],
    ['SUCCEED', 'deployed'],
    [null, undefined],
  ])('classifies %s as %s', (status, expected) => {
    const set = findStatusSet('amplify');
    if (!set) throw new Error('missing preset');
    expect(classify({ branch: 'main', status }, set)?.id).toBe(expected);
  });
});

describe('findStatusSet', () => {
  it('finds presets first, then custom sets', () => {
    const preset = PRESETS.find((p) => p.id === 'amplify');
    if (!preset) throw new Error('no presets');
    const custom = { ...preset, id: 'mine' };
    expect(findStatusSet('mine', [custom])).toBe(custom);
    expect(findStatusSet(preset.id, [{ ...preset, name: 'shadow' }])).toBe(
      preset,
    );
    expect(findStatusSet('nope')).toBeUndefined();
  });
});
