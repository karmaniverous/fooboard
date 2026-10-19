/**
 * Parity (spec.md A§4.3.7 *Demo and parity*): the built-in rules give the
 * same status as the PR S presets on every run in a generated set of job
 * mixes (names, statuses, conclusions) and every Amplify job status,
 * including runs with no job either counts.
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
import { classify as classifyOld } from '@/domain/statuses/classify';
import { githubRunDocument } from '@/domain/statuses/documents';
import { presetById } from '@/domain/statuses/presets';

import { BUILTIN_SETS } from './builtinSets';
import { BUILTIN_SOURCES } from './builtinSources';
import { type CellRules, placeCell } from './cell';
import { asJson } from './json';
import { always } from './ruleBuilders';
import { translate } from './translate';

const source = (id: string) => {
  const s = BUILTIN_SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};
const set = (id: string) => {
  const s = BUILTIN_SETS.find((x) => x.id === id);
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

function newStatus(setId: string, entry: unknown): string | undefined {
  const sourceRule = source(set(setId).provider);
  const { record } = translate(sourceRule, asJson(entry));
  const rules: CellRules = {
    record: always,
    items: always,
    stage: always,
    set: set(setId),
    order: sourceRule.order,
  };
  const placed = placeCell([record], rules);
  return placed ? (placed.status?.id ?? 'unknown') : undefined;
}

describe('parity with the PR S presets', () => {
  it.each(['github-deploy-test', 'github-single-job'])('%s', async (id) => {
    const preset = presetById(id);
    const cases = mixes();
    expect(cases.length).toBeGreaterThan(400);
    const rows = cases.map((jobs) => {
      const entry = run(jobs);
      const doc = githubRunDocument(entry, [], preset.jobs);
      return {
        jobs: jobs.map((j) => [j.name, j.status, j.conclusion].join(' ')),
        status: doc ? (classifyOld(doc, preset)?.id ?? 'unknown') : 'none',
      };
    });
    // The PR S results, frozen; the rules must keep giving them.
    await expect(JSON.stringify(rows, null, 1)).toMatchFileSnapshot(
      `./__fixtures__/parity-${id}.json`,
    );
    for (const [i, jobs] of cases.entries())
      expect([i, newStatus(id, run(jobs)) ?? 'none']).toEqual([
        i,
        rows[i]?.status,
      ]);
  });

  it('amplify', async () => {
    const preset = presetById('amplify');
    const statuses = [
      'FAILED',
      'CANCELLED',
      'CANCELLING',
      'RUNNING',
      'PENDING',
      'PROVISIONING',
      'CREATED',
      'SUCCEED',
      'UNEXPECTED',
    ];
    const rows = statuses.map((status) => ({
      status,
      shows:
        classifyOld(
          {
            branch: 'main',
            status,
            commitId: 'abc',
            startTime: null,
            endTime: null,
          },
          preset,
        )?.id ?? 'unknown',
    }));
    await expect(JSON.stringify(rows, null, 1)).toMatchFileSnapshot(
      './__fixtures__/parity-amplify.json',
    );
    for (const { status, shows } of rows) {
      const raw = {
        source: { region: 'us-east-1', appId: 'a' },
        branch: 'main',
        job: {
          jobId: '1',
          status,
          commitId: 'abc',
          startTime: '2026-10-19T00:00:00Z',
        },
        consoleUrl: 'https://console.aws.amazon.com/amplify',
      };
      expect([status, newStatus('amplify', raw)]).toEqual([status, shows]);
    }
  });
});
