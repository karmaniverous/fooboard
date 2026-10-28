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
  rowFromApp,
  rowFromRepo,
  uniqueId,
} from './edit';

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
      { id: 'b', name: 'b', rules: branchRules('dev'), settings: {} },
    ]);
    expect(s.columnGroups).toEqual([]);
    expect(s.rowGroups[0]?.stageRules).toEqual({});
  });

  it("drops a row's settings for the removed stage's cell, so the dashboard still saves", () => {
    const chosen = DashboardSchema.parse({
      ...d,
      rows: d.rows.map((r) => ({
        ...r,
        cellSettings: {
          a: { statusSets: { github: PRESET_IDS.githubSingleJob } },
          b: { statusSets: { github: PRESET_IDS.githubSingleJob } },
        },
      })),
    });
    const s = DashboardSchema.parse(removeStage(chosen, 'a'));
    expect(s.rows[0]?.cellSettings).toEqual({
      b: { statusSets: { github: PRESET_IDS.githubSingleJob } },
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
      settings: {},
    });
    expect(rowFromRepo('acme/api-core', d, 'tok').settings).toEqual({
      githubToken: 'tok',
    });
    const app = { appId: 'a1', name: 'site', region: 'us-east-1' };
    expect(
      rowFromApp(app, d, { credentialId: 'k1', pinned: true }).pinnedApps,
    ).toEqual([{ region: 'us-east-1', appId: 'a1', credentialId: 'k1' }]);
    expect(
      rowFromApp(app, d, { repo: 'acme/site', pinned: true }),
    ).toMatchObject({
      repo: 'acme/site',
      pinnedApps: [{ region: 'us-east-1', appId: 'a1' }],
      settings: {},
    });
    expect(rowFromApp(app, d, { pinned: false }).pinnedApps).toEqual([
      { region: 'us-east-1', appId: 'a1' },
    ]);
    // The only app building its repo: found by repo, not pinned.
    expect(
      rowFromApp(app, d, {
        credentialId: 'k1',
        repo: 'acme/site',
        pinned: false,
        awsKey: 'k1',
      }),
    ).toMatchObject({
      repo: 'acme/site',
      pinnedApps: [],
      settings: { awsKey: 'k1' },
    });
  });
});

describe('duplicateDashboard', () => {
  it('re-keys every credential reference and keeps groups and overrides', () => {
    const d = DashboardSchema.parse({
      id: 'd',
      name: 'D',
      credentials: [{ id: 'c', kind: 'github', label: 'gh' }],
      settings: { githubToken: 'c' },
      rows: [
        {
          type: 'github',
          id: 'r',
          repo: 'o/r',
          displayName: 'r',
          settings: { githubToken: 'c' },
          cellSettings: { s: { githubToken: 'c' } },
          stageRules: { s: branchRule('rc/*') },
        },
      ],
      stages: [{ id: 's', name: 's', rules: branchRules('main') }],
      rowGroups: [
        {
          id: 'g',
          memberIds: ['r'],
          stageRules: { s: branchRules('release/*') },
          settings: { githubToken: 'c' },
        },
      ],
    });
    const copy = DashboardSchema.parse(
      duplicateDashboard(d, 'd2', 'D copy', (old) => `${old}-new`),
    );
    expect(copy).toMatchObject({ id: 'd2', name: 'D copy' });
    expect(JSON.stringify(copy)).not.toMatch(/"c"/);
    expect(copy.settings.githubToken).toBe('c-new');
    expect(copy.rowGroups[0]).toMatchObject({
      stageRules: { s: branchRules('release/*') },
      settings: { githubToken: 'c-new' },
    });
    expect(copy.rows[0]).toMatchObject({
      settings: { githubToken: 'c-new' },
      cellSettings: { s: { githubToken: 'c-new' } },
    });
    expect(copy.rows[0]?.stageRules).toEqual({ s: branchRule('rc/*') });
    expect(d.credentials[0]?.id).toBe('c');
  });
});
