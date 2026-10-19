/**
 * Tests for Amplify targets: rows sharing an app are grouped and the app
 * read once per refresh; a kept job no row's cells place is unmapped with
 * each row's reason; a full read gives the empty cells a window hint.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { branchRules } from '@/domain/config/placement';
import type { AmplifyRow } from '@/domain/config/row';
import { amplifySet } from '@/domain/derivation/testFixtures';
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import type { CellRules } from '@/domain/model/cell';
import { always } from '@/domain/model/ruleBuilders';
import { amplifyBranch, amplifyJobSummary } from '@/lib/amplify/sdkShapes';
import { fakeAmplifyReader } from '@/test/fakeReaders';

import {
  amplifyGroups,
  type AmplifyTargetInput,
  refreshAmplifyTarget,
} from './amplifyTarget';

const amplify = BUILTIN_SOURCES[1];
const row = (id: string, appIds: string[]): AmplifyRow => ({
  type: 'amplify',
  id,
  repo: `acme/${id}`,
  displayName: id,
  sources: appIds.map((appId) => ({
    credentialId: 'aws',
    region: 'us-east-1',
    appId,
  })),
  stageRules: {},
  cellStatusSets: {},
});
const stages = [{ id: 'prod', name: 'Prod', rules: branchRules('main') }];
const rulesFor = (_: AmplifyRow, stageId: string): CellRules => ({
  record: always,
  items: always,
  stage: stages.find((s) => s.id === stageId)?.rules.amplify,
  set: amplifySet,
  order: 'started',
});
const job = (jobId: string) =>
  amplifyJobSummary({
    jobId,
    status: 'SUCCEED',
    startTime: new Date(`2026-10-16T00:00:0${jobId}Z`),
  });

function setup(branches: string[], jobs = [job('1')]) {
  const listBranches = vi.fn(() =>
    Promise.resolve(
      branches.map((branchName) => amplifyBranch({ branchName })),
    ),
  );
  const listJobs = vi.fn(() => Promise.resolve(jobs));
  const reader = fakeAmplifyReader({ listBranches, listJobs });
  const readersFor: AmplifyTargetInput['readersFor'] = () => () => reader;
  return { listBranches, listJobs, readersFor };
}

describe('amplifyGroups', () => {
  it('groups rows that share an app, in board order', () => {
    const rows = [row('a', ['x']), row('b', ['y']), row('c', ['y', 'x'])];
    const groups = amplifyGroups(rows, (r) => r.sources.map((s) => s.appId));
    expect(groups.map((g) => g.map((r) => r.id))).toEqual([['a', 'b', 'c']]);
    expect(
      amplifyGroups([row('a', ['x']), row('b', ['y'])], (r) =>
        r.sources.map((s) => s.appId),
      ).map((g) => g.map((r) => r.id)),
    ).toEqual([['a'], ['b']]);
  });
});

describe('refreshAmplifyTarget', () => {
  const input = (
    rows: AmplifyRow[],
    readersFor: AmplifyTargetInput['readersFor'],
  ): AmplifyTargetInput => ({
    rows,
    stages,
    rulesFor,
    defaultsFor: () => ({}),
    readersFor,
    source: amplify,
    githubFor: () => undefined,
  });

  it('reads an app once for every row that uses it', async () => {
    const { listBranches, listJobs, readersFor } = setup(['main']);
    const result = await refreshAmplifyTarget(
      input([row('a', ['x']), row('b', ['x'])], readersFor),
    );
    expect(listBranches).toHaveBeenCalledOnce();
    expect(listJobs).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      kind: 'refreshed',
      rows: {
        a: { cells: { prod: { derivation: { kind: 'ok' } } } },
        b: { cells: { prod: { derivation: { kind: 'ok' } } } },
      },
      unmapped: [],
    });
  });

  it('lists a kept job no cell places, with each row reason', async () => {
    const { readersFor } = setup(['feature/x']);
    const result = await refreshAmplifyTarget(
      input([row('a', ['x']), row('b', ['x'])], readersFor),
    );
    if (result.kind !== 'refreshed') throw new Error('not refreshed');
    expect(result.unmapped).toHaveLength(1);
    expect(result.unmapped[0]).toMatchObject({
      provider: 'amplify',
      where: 'x',
      title: 'Amplify job 1',
      branch: 'feature/x',
      reason: { kind: 'no-stage-matches', branch: 'feature/x' },
      rows: [
        { rowId: 'a', reason: { kind: 'no-stage-matches' } },
        { rowId: 'b', reason: { kind: 'no-stage-matches' } },
      ],
    });
  });

  it('hints at reading more for an empty cell after a full read', async () => {
    const full = Array.from({ length: 20 }, (_, i) => job(String(i % 10)));
    const { readersFor } = setup(['feature/x'], full);
    const result = await refreshAmplifyTarget(
      input([row('a', ['x'])], readersFor),
    );
    if (result.kind !== 'refreshed') throw new Error('not refreshed');
    expect(result.problems).toContainEqual(
      expect.objectContaining({
        level: { kind: 'cell', rowId: 'a', stageId: 'prod' },
        target: { kind: 'source', provider: 'amplify' },
        dismissable: true,
      }),
    );
    expect(result.problems[0]?.message).toContain('20 jobs per branch');
    const { readersFor: few } = setup(['feature/x']);
    const quiet = await refreshAmplifyTarget(input([row('a', ['x'])], few));
    expect(quiet.kind === 'refreshed' && quiet.problems).toEqual([]);
  });
});
