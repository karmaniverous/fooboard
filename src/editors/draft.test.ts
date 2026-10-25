/**
 * Tests for the editor drafts: each unmapped reason leads to its fix with
 * a check drafted from the record (the row's record rule, the item rule
 * of the set the row uses, the source rule's order key), *Add override*
 * on the rows reading the record, a record no row on the board reads
 * offering none, and *Fix* opening the editor at the problem's item.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { UNMAPPED } from '@/domain/derivation';
import { is } from '@/domain/model/ruleBuilders';
import { problem } from '@/domain/problems/problem';
import type { UnmappedRun } from '@/engine';

import { draftFor, overrideDraftFor, placeDraft, problemDraft } from './draft';

const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  rows: [
    {
      type: 'amplify',
      id: 'site',
      repo: 'acme/api',
      displayName: 'site',
      sources: [{ region: 'us-east-1', appId: 'a1' }],
    },
    { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
  ],
});
const run = (
  reason: UnmappedRun['reason'],
  repo = 'acme/api',
): UnmappedRun => ({
  provider: 'github',
  id: `github:${repo}#1`,
  where: repo,
  rows: repo === 'acme/api' ? [{ rowId: 'api', reason }] : [],
  title: 'Deploy API',
  branch: 'hotfix/1',
  htmlUrl: '',
  record: {
    time: '2026-10-16T00:00:00Z',
    workflow: 'Deploy [api]',
    branch: 'hotfix/1',
    items: [{ name: 'build', state: 'failed' }],
  },
  reason,
});

describe('draftFor', () => {
  it('opens the row rule with a check drafted from the record', () => {
    expect(draftFor(run({ kind: UNMAPPED.noRowMatches }), dashboard)).toEqual({
      tab: 'Rows',
      focus: ['row:api:record', 'row:api'],
      check: is('$.workflow', 'Deploy [[]api[]]'),
    });
  });

  it('opens a new stage for a branch no stage rule matches', () => {
    expect(
      draftFor(
        run({ kind: UNMAPPED.noStageMatches, branch: 'hotfix/1' }),
        dashboard,
      ),
    ).toEqual({ tab: 'Stages', pattern: 'hotfix/1', focus: ['stage-new'] });
  });

  it("opens the item rule of the row's status set, drafted from an item", () => {
    expect(draftFor(run({ kind: UNMAPPED.noItemCounts }), dashboard)).toEqual({
      tab: 'Statuses',
      focus: [
        'statusSet:github-deploy-test:items',
        'statusSet:github-deploy-test',
        'dashboard:statusSets',
      ],
      check: is('$.name', 'build'),
    });
  });

  it("opens the source rule's order key for a record without one", () => {
    expect(draftFor(run({ kind: UNMAPPED.noOrderKey }), dashboard)).toEqual({
      tab: 'Sources',
      focus: [
        'source:github:key:created',
        'source:github',
        'source-choice:github',
      ],
    });
  });

  it('offers an override on the rows reading the record, for an unmatched branch only', () => {
    const branch = run({ kind: UNMAPPED.noStageMatches, branch: 'hotfix/1' });
    expect(overrideDraftFor(branch, dashboard)).toEqual({
      tab: 'Rows',
      focus: ['row:api:override', 'row:api'],
      override: { branch: 'hotfix/1', rowIds: ['api'] },
    });
    expect(
      overrideDraftFor(run({ kind: UNMAPPED.noItemCounts }), dashboard),
    ).toBeUndefined();
  });

  it('offers nothing when no row on the board reads the record', () => {
    expect(
      draftFor(run({ kind: UNMAPPED.noRowMatches }, 'acme/other'), dashboard),
    ).toBeUndefined();
    expect(
      overrideDraftFor(
        run({ kind: UNMAPPED.noStageMatches, branch: 'x' }, 'acme/other'),
        dashboard,
      ),
    ).toBeUndefined();
  });
});

describe('problemDraft', () => {
  it('opens the editor at the exact item', () => {
    expect(
      problemDraft(
        problem({ kind: 'row', id: 'web' }, 'x', false, {
          target: { kind: 'row', id: 'web', stageId: 'dev' },
        }),
      ),
    ).toEqual({ tab: 'Rows', focus: ['row:web:stage:dev', 'row:web'] });
    expect(problemDraft(problem({ kind: 'stage', id: 'dev' }, 'x'))).toEqual({
      tab: 'Stages',
      focus: ['stage:dev:rules', 'stage:dev'],
    });
    expect(
      problemDraft(
        problem({ kind: 'dashboard' }, 'x', false, {
          target: { kind: 'source', provider: 'amplify', key: 'state' },
        }),
      ),
    ).toEqual({
      tab: 'Sources',
      focus: [
        'source:amplify:key:state',
        'source:amplify',
        'source-choice:amplify',
      ],
    });
    expect(
      problemDraft(problem({ kind: 'statusSet', id: 'mine' }, 'x')),
    ).toEqual({
      tab: 'Statuses',
      focus: ['statusSet:mine', 'dashboard:statusSets'],
    });
    expect(
      problemDraft(
        problem({ kind: 'dashboard' }, 'x', false, {
          target: { kind: 'dashboard', part: 'stageRules' },
        }),
      ),
    ).toEqual({ tab: 'Stages', focus: ['dashboard:stageRules'] });
  });
});

describe('placeDraft', () => {
  it.each([
    [{ level: 'dashboard' } as const, 'General', ['dashboard:settings']],
    [
      { level: 'row', rowId: 'r' } as const,
      'Rows',
      ['row:r:settings', 'row:r'],
    ],
    [
      { level: 'cell', rowId: 'r', stageId: 's' } as const,
      'Rows',
      ['row:r:cells:s:settings', 'row:r:cells:s'],
    ],
    [
      { level: 'rowGroup', groupId: 'g' } as const,
      'Rows',
      ['rowGroup:g:settings', 'rowGroup:g'],
    ],
    [
      { level: 'column', stageId: 's' } as const,
      'Stages',
      ['stage:s:settings', 'stage:s'],
    ],
    [
      { level: 'columnGroup', groupId: 'g' } as const,
      'Stages',
      ['columnGroup:g:settings', 'columnGroup:g'],
    ],
  ])('opens the editor at %j', (place, tab, focus) => {
    expect(placeDraft(place)).toEqual({ tab, focus });
  });
});
