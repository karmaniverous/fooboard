/**
 * Tests for Unknown runs: the board's Unknown cells are listed; *Add
 * status* copies a preset into the dashboard, chooses the copy only at the
 * level that chose the preset, and puts a status on top that matches the
 * run; a custom set gets the status in place.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { all, exists, not } from '@/domain/model/ruleBuilders';
import type { RecordDoc } from '@/domain/model/translate';
import { classify } from '@/domain/statuses/classify';
import { statusSetFor } from '@/domain/statuses/resolve';
import { UNKNOWN } from '@/domain/statuses/resolved';
import { type BoardCell, cellKey } from '@/engine';

import { addStatusFor, unknownCells } from './unknownRuns';

const run: RecordDoc = {
  workflow: 'Release',
  event: 'push',
  branch: 'main',
  items: [{ name: 'publish', state: 'skipped', time: '', link: '' }],
};

const base = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  stages: [
    { id: 'dev', name: 'Dev', branchPattern: 'dev' },
    { id: 'prod', name: 'Prod', branchPattern: 'main' },
  ],
  rows: [
    { type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' },
    {
      type: 'github',
      id: 'api',
      repo: 'acme/api',
      displayName: 'api',
      cellStatusSets: { prod: 'github-single-job' },
    },
  ],
});

const unknownCell = (rowId: string, stageId: string): BoardCell => ({
  rowId,
  stageId,
  active: false,
  badge: undefined,
  derivation: {
    kind: 'ok',
    status: UNKNOWN,
    branch: 'main',
    commit: 'abc',
    time: undefined,
    linkUrl: '',
    document: run,
  },
});

describe('unknownCells', () => {
  it('lists Unknown cells with their set and document', () => {
    const cells = {
      [cellKey('api', 'prod')]: unknownCell('api', 'prod'),
      [cellKey('web', 'dev')]: undefined,
    };
    expect(unknownCells(base, { cells })).toEqual([
      {
        rowId: 'api',
        rowName: 'api',
        stageId: 'prod',
        stageName: 'Prod',
        setName: 'GitHub single job',
        document: run,
      },
    ]);
  });
});

describe('addStatusFor', () => {
  it('copies the preset at the level that chose it and matches the run', () => {
    const next = addStatusFor(base, {
      rowId: 'api',
      stageId: 'prod',
      document: run,
    });
    expect(DashboardSchema.safeParse(next).success).toBe(true);
    const api = next.rows[1];
    expect(api.cellStatusSets.prod).toBe('custom-github');
    // Other cells and the dashboard keep their sets.
    expect(next.statusSets.github).toBe('github-deploy-test');
    const set = statusSetFor(next, api, 'prod');
    expect(classify(run, set)?.id).toBe(set.cell[0]?.id);
    expect(set.cell[0]?.name).toBe('New status');
  });

  it('adds to a custom set in place', () => {
    const once = addStatusFor(base, {
      rowId: 'web',
      stageId: 'dev',
      document: run,
    });
    expect(once.statusSets.github).toBe('custom-github');
    const twice = addStatusFor(once, {
      rowId: 'web',
      stageId: 'dev',
      document: run,
    });
    expect(twice.customStatusSets).toHaveLength(1);
    expect(twice.customStatusSets[0]?.cell.length).toBe(
      (once.customStatusSets[0]?.cell.length ?? 0) + 1,
    );
  });

  it.each([
    [
      'row',
      {
        rows: [
          { ...base.rows[0], statusSet: 'github-single-job' },
          base.rows[1],
        ],
      },
    ],
    [
      'row group',
      {
        rowGroups: [
          {
            id: 'g',
            memberIds: ['web'],
            statusSets: { github: 'github-single-job' },
          },
        ],
      },
    ],
  ])('chooses the copy at the %s that chose the preset', (_, change) => {
    const d = DashboardSchema.parse({ ...base, ...change });
    const next = addStatusFor(d, {
      rowId: 'web',
      stageId: 'dev',
      document: run,
    });
    expect(next.statusSets.github).toBe('github-deploy-test');
    expect(statusSetFor(next, next.rows[0], 'dev').id).toBe('custom-github');
    expect(statusSetFor(next, next.rows[1], 'dev').id).toBe(
      'github-deploy-test',
    );
  });

  it("drafts from an Amplify job's status, or matches nothing for an unreadable document", () => {
    const job = { branch: 'main', state: 'cancelled', commit: 'a' };
    const amplify = addStatusFor(base, {
      rowId: 'web',
      stageId: 'dev',
      document: job,
    });
    const set = statusSetFor(amplify, amplify.rows[0], 'dev');
    expect(classify(job, set)?.id).toBe(set.cell[0]?.id);
    const odd = addStatusFor(base, {
      rowId: 'web',
      stageId: 'dev',
      document: 42,
    });
    expect(odd.customStatusSets[0]?.cell[0]?.rule).toEqual(
      all(not(exists('$'))),
    );
  });

  it('leaves the dashboard alone for a row it does not have', () => {
    expect(
      addStatusFor(base, { rowId: 'gone', stageId: 'dev', document: run }),
    ).toBe(base);
  });

  it.each([
    [
      'a GitHub job still running (no conclusion)',
      'github',
      {
        ...run,
        items: [{ name: 'publish', state: null, time: '', link: '' }],
      },
    ],
    [
      'an Amplify job with no status',
      'amplify',
      { branch: 'main', state: null },
    ],
  ])('drafts a status that matches %s', (_, kind, document) => {
    const next = addStatusFor(base, { rowId: 'web', stageId: 'dev', document });
    const [added] = next.customStatusSets[0]?.cell ?? [];
    expect(classify(document, { cell: [added] })?.id).toBe(added.id);
    expect(kind).toBeTruthy();
  });
});
