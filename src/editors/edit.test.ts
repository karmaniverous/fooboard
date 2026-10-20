/**
 * Tests for the editing helpers: readable unique ids, rows from repos,
 * independent duplicates, and removing rows and stages.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { PRESET_IDS } from '@/domain/config/statusSets';
import { branchRule } from '@/domain/rules/branch';

import {
  duplicateDashboard,
  removeRow,
  removeStage,
  repoFromUrl,
  rowFromRepo,
  uniqueId,
} from './edit';

describe('repoFromUrl', () => {
  it('reads owner/name from a GitHub URL only', () => {
    expect(repoFromUrl('https://github.com/acme/web.git')).toBe('acme/web');
    expect(repoFromUrl('https://github.com/acme/web/')).toBe('acme/web');
    expect(repoFromUrl('https://gitlab.com/acme/web')).toBeUndefined();
    expect(repoFromUrl(undefined)).toBeUndefined();
  });
});

describe('removing rows and stages', () => {
  const d = DashboardSchema.parse({
    id: 'd',
    name: 'D',
    rows: [{ type: 'github', id: 'r', repo: 'o/r', displayName: 'r' }],
    stages: [
      { id: 'a', name: 'a', rules: branchRules('main') },
      { id: 'b', name: 'b', rules: branchRules('dev'), sourceStageId: 'a' },
    ],
    rowGroups: [
      {
        id: 'g',
        memberIds: ['r'],
        stageRules: { a: branchRules('x/*') },
      },
    ],
    columnGroups: [{ id: 'cg', label: 'Prod', memberIds: ['a'] }],
  });

  it('takes the emptied group, the overrides and any source use with it', () => {
    expect(removeRow(d, 'r')).toMatchObject({ rows: [], rowGroups: [] });
    const s = DashboardSchema.parse(removeStage(d, 'a'));
    expect(s.stages).toEqual([
      { id: 'b', name: 'b', rules: branchRules('dev') },
    ]);
    expect(s.columnGroups).toEqual([]);
    expect(s.rowGroups[0]?.stageRules).toEqual({});
  });

  it("drops a row's status-set choice for the removed stage, so the dashboard still saves", () => {
    const chosen = DashboardSchema.parse({
      ...d,
      rows: d.rows.map((r) => ({
        ...r,
        cellStatusSets: {
          a: PRESET_IDS.githubSingleJob,
          b: PRESET_IDS.githubSingleJob,
        },
      })),
    });
    const s = DashboardSchema.parse(removeStage(chosen, 'a'));
    expect(s.rows[0]?.cellStatusSets).toEqual({
      b: PRESET_IDS.githubSingleJob,
    });
  });
});

describe('uniqueId and rowFromRepo', () => {
  it('slugs, de-duplicates, and names a row after its repo', () => {
    expect(uniqueId('Release/24.3', [])).toBe('release-24-3');
    expect(uniqueId('api', ['api', 'api-2'])).toBe('api-3');
    const d = DashboardSchema.parse({ id: 'd', name: 'D' });
    expect(rowFromRepo('acme/api-core', d)).toMatchObject({
      id: 'api-core',
      repo: 'acme/api-core',
      displayName: 'api-core',
    });
  });
});

describe('duplicateDashboard', () => {
  it('re-keys every credential reference and keeps groups and overrides', () => {
    const d = DashboardSchema.parse({
      id: 'd',
      name: 'D',
      credentials: [{ id: 'c', kind: 'github', label: 'gh' }],
      defaultCredentials: { github: 'c' },
      rows: [
        {
          type: 'github',
          id: 'r',
          repo: 'o/r',
          displayName: 'r',
          credentialId: 'c',
          stageRules: { s: branchRule('rc/*') },
        },
      ],
      stages: [{ id: 's', name: 's', rules: branchRules('main') }],
      rowGroups: [
        {
          id: 'g',
          memberIds: ['r'],
          stageRules: { s: branchRules('release/*') },
          defaultCredentials: { github: 'c' },
        },
      ],
    });
    const copy = DashboardSchema.parse(
      duplicateDashboard(d, 'd2', 'D copy', (old) => `${old}-new`),
    );
    expect(copy).toMatchObject({ id: 'd2', name: 'D copy' });
    expect(JSON.stringify(copy)).not.toMatch(/"c"/);
    expect(copy.defaultCredentials.github).toBe('c-new');
    expect(copy.rowGroups[0]).toMatchObject({
      stageRules: { s: branchRules('release/*') },
      defaultCredentials: { github: 'c-new' },
    });
    expect(copy.rows[0]?.stageRules).toEqual({ s: branchRule('rc/*') });
    expect(d.credentials[0]?.id).toBe('c');
  });
});
