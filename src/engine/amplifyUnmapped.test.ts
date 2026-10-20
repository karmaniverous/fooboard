/**
 * Tests for unmapped Amplify jobs: a kept job no row reading its app
 * places, with each row's reason, and what the panel shows when its raw
 * data is incomplete.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { PROVIDER_LABELS } from '@/domain/config/providers';
import type { AmplifyRow } from '@/domain/config/row';
import { PRESET_IDS } from '@/domain/config/statusSets';
import { UNMAPPED } from '@/domain/derivation';
import { BUILTIN_ORDER_KEYS } from '@/domain/model/builtinSources';
import type { CellRules } from '@/domain/model/cell';
import type { RecordDoc } from '@/domain/model/translate';
import { always } from '@/domain/rules/always';
import { branchRule } from '@/domain/rules/branch';
import { presetById } from '@/domain/statuses/presets';
import { appKey, type ResolvedAmplifySource } from '@/lib/amplify/rowJobs';

import { amplifyUnmapped } from './amplifyUnmapped';

const source: ResolvedAmplifySource = {
  credentialId: 'aws',
  region: 'us-east-1',
  appId: 'app1',
};
const key = appKey(source);
const row = (id: string): AmplifyRow => ({
  type: 'amplify',
  id,
  displayName: id,
  repo: '',
  sources: [{ region: source.region, appId: source.appId }],
  cellStatusSets: {},
  stageRules: {},
});
const rules: CellRules = {
  record: always,
  items: always,
  stage: branchRule('main'),
  set: presetById(PRESET_IDS.amplify),
  order: BUILTIN_ORDER_KEYS.amplify,
};
const input = (rows: AmplifyRow[]) => ({
  rows,
  stages: [{ id: 'prod', name: 'prod', rules: {} }],
  rulesFor: () => rules,
});
const unmapped = (records: RecordDoc[], rows = [row('site')]) =>
  amplifyUnmapped(
    input(rows),
    new Map(rows.map((r) => [r.id, [source]])),
    new Map([[key, { records }]]),
  );

describe('amplifyUnmapped', () => {
  it('lists a job no row places, with each row reading its app', () => {
    const [run] = unmapped(
      [
        {
          branch: 'feature/x',
          [BUILTIN_ORDER_KEYS.amplify]: '2026-10-01T00:00:00Z',
          link: 'https://console/job/7',
          _raw: { job: { jobId: '7' }, source: { appId: 'app1' } },
        },
      ],
      [row('site'), row('docs')],
    );
    const reason = { kind: UNMAPPED.noStageMatches, branch: 'feature/x' };
    expect(run).toMatchObject({
      provider: 'amplify',
      id: `amplify:${key}:feature/x#7`,
      where: 'app1',
      title: 'Amplify job 7',
      branch: 'feature/x',
      htmlUrl: 'https://console/job/7',
      reason,
      rows: [
        { rowId: 'site', reason },
        { rowId: 'docs', reason },
      ],
    });
  });

  it('skips a job a row places', () => {
    expect(
      unmapped([
        {
          branch: 'main',
          [BUILTIN_ORDER_KEYS.amplify]: '2026-10-01T00:00:00Z',
        },
      ]),
    ).toEqual([]);
  });

  it('falls back on the raw branch, then says what it lacks', () => {
    const [fromRaw, bare] = unmapped([
      { _raw: { branch: 'feature/y', job: 'odd', source: null } },
      { branch: '' },
    ]);
    expect(fromRaw).toMatchObject({
      branch: 'feature/y',
      where: PROVIDER_LABELS.amplify,
      title: 'Amplify job ?',
      htmlUrl: '',
    });
    expect(bare).toMatchObject({ branch: null, id: `amplify:${key}:#` });
  });

  it('keeps jobs apart when a source rule translates their branches to one value', () => {
    const job = (branch: string) => ({
      branch: 'preview',
      [BUILTIN_ORDER_KEYS.amplify]: '2026-10-01T00:00:00Z',
      _raw: { branch, job: { jobId: '1' }, source: { appId: 'app1' } },
    });
    const runs = unmapped([job('preview/a'), job('preview/b')]);
    expect(runs.map((r) => r.branch)).toEqual(['preview', 'preview']);
    expect(runs.map((r) => r.id)).toEqual([
      `amplify:${key}:preview/a#1`,
      `amplify:${key}:preview/b#1`,
    ]);
  });

  it('lists nothing for an app no row reads', () => {
    expect(
      amplifyUnmapped(
        input([row('site')]),
        new Map(),
        new Map([[key, { records: [{ branch: 'x' }] }]]),
      ),
    ).toEqual([]);
  });
});
