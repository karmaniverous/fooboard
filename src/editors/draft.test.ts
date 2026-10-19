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
import { is } from '@/domain/model/ruleBuilders';
import { problem } from '@/domain/problems/problem';
import type { UnmappedRun } from '@/engine';

import { draftFor, overrideDraftFor, problemDraft } from './draft';

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
    expect(draftFor(run({ kind: 'no-row-matches' }), dashboard)).toEqual({
      tab: 'Rows',
      focus: ['row:api:record', 'row:api'],
      check: is('$.workflow', 'Deploy [[]api[]]'),
    });
  });

  it('opens a new stage for a branch no stage rule matches', () => {
    expect(
      draftFor(
        run({ kind: 'no-stage-matches', branch: 'hotfix/1' }),
        dashboard,
      ),
    ).toEqual({ tab: 'Stages', pattern: 'hotfix/1', focus: ['stage-new'] });
  });

  it("opens the item rule of the row's status set, drafted from an item", () => {
    expect(draftFor(run({ kind: 'no-item-counts' }), dashboard)).toEqual({
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
    expect(draftFor(run({ kind: 'no-order-key' }), dashboard)).toEqual({
      tab: 'Sources',
      focus: [
        'source:github:key:created',
        'source:github',
        'source-choice:github',
      ],
    });
  });

  it('offers an override on the rows reading the record, for an unmatched branch only', () => {
    const branch = run({ kind: 'no-stage-matches', branch: 'hotfix/1' });
    expect(overrideDraftFor(branch, dashboard)).toEqual({
      tab: 'Rows',
      focus: ['row:api:override', 'row:api'],
      override: { branch: 'hotfix/1', rowIds: ['api'] },
    });
    expect(
      overrideDraftFor(run({ kind: 'no-item-counts' }), dashboard),
    ).toBeUndefined();
  });

  it('offers nothing when no row on the board reads the record', () => {
    expect(
      draftFor(run({ kind: 'no-row-matches' }, 'acme/other'), dashboard),
    ).toBeUndefined();
    expect(
      overrideDraftFor(
        run({ kind: 'no-stage-matches', branch: 'x' }, 'acme/other'),
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
