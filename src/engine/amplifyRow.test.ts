/**
 * Tests for `refreshAmplifyRow`'s failure handling: a missing credential,
 * a rejected one, throttling (keep previous cells) and other errors; the
 * source rule's keep rule drops records.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import type { DefaultCredentials } from '@/domain/config/credentialRefs';
import { branchRules } from '@/domain/config/placement';
import type { AmplifyRow } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import { EMPTY_STATES } from '@/domain/derivation/index';
import { amplifySet } from '@/domain/derivation/testFixtures';
import { builtinSourceFor } from '@/domain/model/builtinSources';
import type { CellRules } from '@/domain/model/cell';
import { all, is, not } from '@/domain/model/ruleBuilders';
import type { SourceRuleOf } from '@/domain/model/sourceRule';
import { always } from '@/domain/rules/always';
import { AmplifyAuthError, AmplifyThrottledError } from '@/lib/amplify/errors';
import type { AmplifyReader } from '@/lib/amplify/reader';
import type { AmplifyReaderFor } from '@/lib/amplify/rowJobs';
import { amplifyBranch, amplifyJobSummary } from '@/lib/amplify/sdkShapes';
import { fakeAmplifyReader } from '@/test/fakeReaders';

import { refreshAmplifyRows } from './amplifyRow';

/** One row's refresh through the shared-app refresh, as its cells. */
async function refreshAmplifyRow(
  row: AmplifyRow,
  stages: readonly Stage[],
  rulesFor: (stageId: string) => CellRules,
  defaults: DefaultCredentials,
  readersFor: (id: string) => AmplifyReaderFor | undefined,
  source: SourceRuleOf<'amplify'> = amplifySource,
) {
  const result = await refreshAmplifyRows({
    rows: [row],
    stages,
    rulesFor: (_, stageId) => rulesFor(stageId),
    defaultsFor: () => defaults,
    readersFor,
    source,
  });
  return result.kind === 'rate-limited'
    ? result
    : { kind: result.kind, cells: result.rows[row.id] };
}

const row: AmplifyRow = {
  type: 'amplify',
  id: 'site',
  repo: 'acme/site',
  displayName: 'site',
  sources: [{ credentialId: 'aws', region: 'us-east-1', appId: 'a1' }],
  stageRules: {},
  cellStatusSets: {},
};
const stages = [{ id: 'prod', name: 'Prod', rules: branchRules('main') }];
const defaults = {};
const amplifySource = builtinSourceFor('amplify');
const rulesFor = (stageId: string): CellRules => ({
  record: always,
  items: always,
  stage: stages.find((s) => s.id === stageId)?.rules.amplify,
  set: amplifySet,
  order: 'started',
});

const failing = (err: Error) => () =>
  ({
    listApps: () => Promise.reject(err),
    listBranches: () => Promise.reject(err),
    listJobs: () => Promise.reject(err),
    getJob: () => Promise.reject(err),
  }) satisfies AmplifyReader;

describe('refreshAmplifyRow', () => {
  it('shows needs credential when no source has a key and there is no default', async () => {
    const keyless: AmplifyRow = {
      ...row,
      sources: [{ region: 'us-east-1', appId: 'a1' }],
    };
    const result = await refreshAmplifyRow(
      keyless,
      stages,
      rulesFor,
      defaults,
      () => failing(new Error('never called')),
    );
    expect(result).toMatchObject({
      cells: { prod: { state: EMPTY_STATES.needsCredential } },
    });
  });

  it('shows needs credential when the key is missing', async () => {
    const result = await refreshAmplifyRow(
      row,
      stages,
      rulesFor,
      defaults,
      () => undefined,
    );
    expect(result).toMatchObject({
      kind: 'refreshed',
      cells: { prod: { kind: 'empty', state: EMPTY_STATES.needsCredential } },
    });
  });

  it('shows needs credential when AWS rejects the key', async () => {
    const result = await refreshAmplifyRow(
      row,
      stages,
      rulesFor,
      defaults,
      () => failing(new AmplifyAuthError('denied', 'ListBranches')),
    );
    expect(result).toMatchObject({
      cells: { prod: { state: EMPTY_STATES.needsCredential } },
    });
  });

  it('keeps the previous cells while throttled', async () => {
    const result = await refreshAmplifyRow(
      row,
      stages,
      rulesFor,
      defaults,
      () =>
        failing(new AmplifyThrottledError('slow down', 'ListBranches', 5_000)),
    );
    expect(result).toEqual({ kind: 'rate-limited' });
  });

  it('shows error with the reason for other failures', async () => {
    const result = await refreshAmplifyRow(
      row,
      stages,
      rulesFor,
      defaults,
      () => failing(new Error('socket hang up')),
    );
    expect(result).toMatchObject({
      cells: { prod: { kind: 'empty', state: 'error' } },
    });
  });
});

describe('refreshAmplifyRow request count', () => {
  it('lists each source once, however many stages it has', async () => {
    const listBranches = vi.fn(() =>
      Promise.resolve([
        amplifyBranch({ branchName: 'main' }),
        amplifyBranch({ branchName: 'dev' }),
      ]),
    );
    const listJobs = vi.fn(() => Promise.resolve([]));
    const reader = fakeAmplifyReader({ listBranches, listJobs });
    const twoSources: AmplifyRow = {
      ...row,
      sources: [
        { region: 'us-east-1', appId: 'a1', credentialId: 'aws' },
        { region: 'eu-west-1', appId: 'a2', credentialId: 'aws' },
      ],
    };
    const sixStages = ['dev', 'test', 'staging', 'main', 'main', 'dev'].map(
      (branch, i) => ({
        id: `s${String(i)}`,
        name: 's',
        rules: branchRules(branch),
      }),
    );
    await refreshAmplifyRow(
      twoSources,
      sixStages,
      rulesFor,
      defaults,
      () => () => reader,
    );
    expect(listBranches).toHaveBeenCalledTimes(2);
    // main and dev, per source: four job lists, not one per stage.
    expect(listJobs).toHaveBeenCalledTimes(4);
  });
});

describe('refreshAmplifyRow keep', () => {
  it('drops records the keep rule rejects', async () => {
    const reader = fakeAmplifyReader({
      listBranches: () =>
        Promise.resolve([amplifyBranch({ branchName: 'main' })]),
      listJobs: () =>
        Promise.resolve([
          amplifyJobSummary({
            jobId: '1',
            status: 'SUCCEED',
            startTime: new Date('2026-10-16T00:00:00Z'),
          }),
        ]),
    });
    const refresh = (keep = always) =>
      refreshAmplifyRow(row, stages, rulesFor, defaults, () => () => reader, {
        ...amplifySource,
        keep,
      });
    expect(await refresh()).toMatchObject({ cells: { prod: { kind: 'ok' } } });
    expect(await refresh(all(not(is('$.branch', 'main'))))).toMatchObject({
      cells: { prod: { kind: 'empty', state: EMPTY_STATES.noRecords } },
    });
  });
});
