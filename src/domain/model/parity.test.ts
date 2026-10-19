/**
 * Parity (spec.md A§4.3.7 *Demo and parity*): the built-in rules give the
 * statuses the PR S presets gave, frozen in `__fixtures__`, on 640 job
 * mixes (names, statuses, conclusions) per GitHub set and every Amplify
 * job status, including runs where no job counts.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type {
  GithubJobConclusion,
  GithubJobStatus,
  GithubRunWithJobs,
  GithubWorkflowJob,
} from '@/domain/derivation/types';
import { presetById } from '@/domain/statuses/presets';

import { BUILTIN_SOURCES } from './builtinSources';
import { type CellRules, placeCell } from './cell';
import { asJson } from './json';
import { always } from './ruleBuilders';
import { translate } from './translate';

/** The PR S results, frozen (formatting aside). */
const FIXTURES: Record<string, unknown> = import.meta.glob(
  './__fixtures__/*.json',
  {
    eager: true,
    import: 'default',
  },
);
const frozen = (name: string): unknown =>
  FIXTURES[`./__fixtures__/parity-${name}.json`];

const source = (id: string) => {
  const s = BUILTIN_SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};

const STATES: [GithubJobStatus, GithubJobConclusion][] = [
  ['queued', null],
  ['waiting', null],
  ['in_progress', null],
  ['completed', 'success'],
  ['completed', 'failure'],
  ['completed', 'timed_out'],
  ['completed', 'cancelled'],
  ['completed', 'skipped'],
  ['completed', 'neutral'],
  ['completed', 'action_required'],
];
const NAMES = ['Deploy (dev)', 'Run tests', 'lint', 'deploy-and-test'];

const job = (
  i: number,
  name: string,
  [status, conclusion]: (typeof STATES)[number],
): GithubWorkflowJob => ({
  id: i,
  runId: 1,
  runAttempt: 1,
  name,
  status,
  conclusion,
  startedAt:
    status === 'queued' || status === 'waiting'
      ? null
      : `2026-10-19T00:0${String(i)}:00Z`,
  completedAt:
    status === 'completed' ? `2026-10-19T00:1${String(i)}:00Z` : null,
  htmlUrl: `https://github.com/acme/web/actions/runs/1/job/${String(i)}`,
});

/** Every one- and two-job mix of names and states. */
function mixes(): GithubWorkflowJob[][] {
  const singles = NAMES.flatMap((n) => STATES.map((s) => job(1, n, s)));
  const pairs = singles.flatMap((a) =>
    singles.filter((b) => b.name > a.name).map((b) => [a, { ...b, id: 2 }]),
  );
  return [...singles.map((j) => [j]), ...pairs];
}

const run = (jobs: GithubWorkflowJob[]): GithubRunWithJobs => ({
  run: {
    id: 1,
    workflowName: 'CI',
    headBranch: 'dev',
    headSha: 'abc',
    createdAt: '2026-10-19T00:00:00Z',
    event: 'push',
    htmlUrl: 'https://github.com/acme/web/actions/runs/1',
  },
  jobs,
});

/** The status the rules give `raw` under set `setId`, or `none` when
 * the record has no counted item. */
function statusOf(setId: string, raw: unknown): string {
  const set = presetById(setId);
  const sourceRule = source(set.provider);
  const rules: CellRules = {
    record: always,
    items: always,
    stage: always,
    set,
    order: sourceRule.order,
  };
  const placed = placeCell([translate(sourceRule, asJson(raw)).record], rules);
  return placed ? (placed.status?.id ?? 'unknown') : 'none';
}

describe('parity with the PR S presets', () => {
  it.each(['github-deploy-test', 'github-single-job'])('%s', (id) => {
    const rows = mixes().map((jobs) => ({
      jobs: jobs.map((j) => [j.name, j.status, j.conclusion].join(' ')),
      status: statusOf(id, run(jobs)),
    }));
    expect(rows.length).toBe(640);
    expect(rows).toEqual(frozen(id));
  });

  it('amplify', () => {
    const rows = [
      'FAILED',
      'CANCELLED',
      'CANCELLING',
      'RUNNING',
      'PENDING',
      'PROVISIONING',
      'CREATED',
      'SUCCEED',
      'UNEXPECTED',
    ].map((status) => ({
      status,
      shows: statusOf('amplify', {
        source: { region: 'us-east-1', appId: 'a' },
        branch: 'main',
        job: {
          jobId: '1',
          status,
          commitId: 'abc',
          startTime: '2026-10-19T00:00:00Z',
        },
        consoleUrl: 'https://console.aws.amazon.com/amplify',
      }),
    }));
    expect(rows).toEqual(frozen('amplify'));
  });
});
