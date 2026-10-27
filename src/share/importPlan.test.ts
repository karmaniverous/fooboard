/**
 * Tests for planning an import (spec.md §3.8 *Credential ids on import*):
 * add, replace and keep as a copy (re-iding at all six settings levels
 * and in pinned apps), replacing the whole setup, a credential id another
 * dashboard here holds, and secrets only for the credentials the imported
 * dashboards reference.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { Dashboard } from '@/domain/config/dashboard';
import { levelsNamed, namedCredentials, shareBoard } from '@/test/shareBoard';

import { type ImportChoice, planImport } from './importPlan';
import type { ShareSecrets } from './secrets';

const ids = () => {
  let n = 0;
  return () => `new-${String(++n)}`;
};
const gh = { kind: 'github', token: 'shared-token' } as const;
const aws = {
  kind: 'aws',
  accessKeyId: 'AKIA',
  secretAccessKey: 'shared-secret',
} as const;
const secrets: ShareSecrets = { 'gh-org': gh, 'aws-prod': aws };
const credIds = (d: Dashboard | undefined) =>
  (d?.credentials ?? []).map((c) => c.id);
const other = (): Dashboard => ({
  ...shareBoard(),
  id: 'other',
  name: 'Other',
  rows: [],
  rowGroups: [],
  columnGroups: [],
  settings: { requestsInFlight: { github: 10, aws: 10 } },
  stages: shareBoard().stages.map((s) => ({ ...s, settings: {} })),
  credentials: [{ id: 'other-gh', kind: 'github', label: 'Other token' }],
});
const add = (
  dashboards: Dashboard[],
  more: Partial<ImportChoice> = {},
): ImportChoice => ({
  dashboards,
  mode: 'add',
  sameId: {},
  secrets,
  ...more,
});

describe('planImport', () => {
  it('adds a new dashboard with its ids, and its secrets under them', () => {
    const incoming = shareBoard();
    const plan = planImport([other()], add([incoming]), ids());
    expect(plan.dashboards.map((d) => d.id)).toEqual(['other', 'northwind']);
    expect(plan.dashboards[1]).toEqual(incoming);
    expect(plan.secrets).toEqual([
      { id: 'gh-org', label: 'Northwind org', secret: gh },
      { id: 'aws-prod', label: 'Prod account', secret: aws },
    ]);
    expect(plan.forget).toEqual([]);
    expect(plan.removed).toEqual([]);
    expect(plan.imported).toEqual(['northwind']);
  });

  it('replaces a dashboard with the same id in place, keeping its ids', () => {
    const before = {
      ...shareBoard(),
      name: 'Old',
      credentials: [
        ...shareBoard().credentials,
        { id: 'dropped', kind: 'github' as const, label: 'Gone' },
      ],
    };
    const incoming = shareBoard();
    const plan = planImport([before, other()], add([incoming]), ids());
    expect(plan.dashboards.map((d) => d.name)).toEqual([
      'Northwind deploys',
      'Other',
    ]);
    expect(plan.dashboards[0]).toEqual(incoming);
    expect(plan.secrets.map((s) => s.id)).toEqual(['gh-org', 'aws-prod']);
    expect(plan.forget).toEqual(['dropped']);
  });

  it('keeps a copy under new ids at all six levels and in pinned apps', () => {
    const incoming = shareBoard();
    expect(levelsNamed(incoming)).toEqual(
      new Set([
        'dashboard',
        'rowGroup',
        'columnGroup',
        'row',
        'stage',
        'cell',
        'pin',
      ]),
    );
    const plan = planImport(
      [shareBoard()],
      add([incoming], { sameId: { northwind: 'copy' } }),
      ids(),
    );
    const [kept, copy] = plan.dashboards;
    expect(kept).toEqual(shareBoard());
    expect(copy.id).toMatch(/^new-/);
    expect(copy.name).toBe('Northwind deploys (copy)');
    expect(plan.imported).toEqual([copy.id]);
    const oldIds = new Set(credIds(incoming));
    const newIds = credIds(copy);
    expect(newIds.some((id) => oldIds.has(id))).toBe(false);
    const named = namedCredentials(copy);
    expect(named).toHaveLength(namedCredentials(incoming).length);
    for (const n of named) {
      expect(newIds).toContain(n.split(':').at(-1));
    }
    expect(levelsNamed(copy)).toEqual(levelsNamed(incoming));
    const where = new Map(newIds.map((id, i) => [credIds(incoming)[i], id]));
    expect(plan.secrets).toEqual([
      { id: where.get('gh-org'), label: 'Northwind org', secret: gh },
      { id: where.get('aws-prod'), label: 'Prod account', secret: aws },
    ]);
    expect(plan.forget).toEqual([]);
  });

  it('gives a new id to a credential id another dashboard here holds', () => {
    const holder = {
      ...other(),
      credentials: [{ id: 'gh-org', kind: 'github' as const, label: 'Mine' }],
    };
    const plan = planImport([holder], add([shareBoard()]), ids());
    const [mine, added] = plan.dashboards;
    expect(mine).toEqual(holder);
    expect(credIds(added)).toEqual([
      'new-1',
      'aws-dev',
      'aws-stage',
      'aws-prod',
    ]);
    expect(added.settings.githubToken).toBe('new-1');
    expect(plan.secrets.map((s) => s.id)).toEqual(['new-1', 'aws-prod']);
  });

  it('replaces the whole setup, forgetting what nothing references', () => {
    const incoming = shareBoard();
    const plan = planImport(
      [other(), { ...shareBoard(), name: 'Old' }],
      { ...add([incoming]), mode: 'replaceAll' },
      ids(),
    );
    expect(plan.dashboards).toEqual([incoming]);
    expect(plan.forget).toEqual(['other-gh']);
    expect(plan.removed).toEqual(['other']);
    expect(plan.imported).toEqual(['northwind']);
    expect(plan.secrets.map((s) => s.id)).toEqual(['gh-org', 'aws-prod']);
  });

  it('stores secrets only for referenced credentials of the right kind', () => {
    const plan = planImport(
      [],
      add([shareBoard()], {
        secrets: {
          'gh-org': aws,
          'aws-dev': aws,
          'not-referenced': gh,
        },
      }),
      ids(),
    );
    expect(plan.secrets).toEqual([
      { id: 'aws-dev', label: 'Dev account', secret: aws },
    ]);
    expect(
      planImport([], add([shareBoard()], { secrets: null }), ids()).secrets,
    ).toEqual([]);
  });
});
