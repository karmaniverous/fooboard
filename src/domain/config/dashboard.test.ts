/**
 * Tests for `DashboardSchema`: defaults for mapping, status sets, groups
 * and credentials, GitHub/Amplify row discrimination, the source-stage cycle
 * guard, and group membership checks.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { branchRules } from '@/domain/config/placement';

import { DashboardSchema } from './dashboard';
import { PRESET_IDS } from './statusSets';

describe('DashboardSchema', () => {
  it('applies source rule, status set, group and credential defaults', () => {
    const dashboard = DashboardSchema.parse({ id: 'd1', name: 'Dashboard 1' });
    expect(dashboard.sourceRules).toEqual({
      github: 'github',
      amplify: 'amplify',
    });
    expect(dashboard.customSourceRules).toEqual([]);
    expect(dashboard.statusSets).toEqual({
      github: PRESET_IDS.githubDeployTest,
      amplify: 'amplify',
    });
    expect(dashboard.customStatusSets).toEqual([]);
    expect(dashboard.rowGroups).toEqual([]);
    expect(dashboard.columnGroups).toEqual([]);
    expect(dashboard.credentials).toEqual([]);
    expect(dashboard.rows).toEqual([]);
  });

  it('parses a GitHub row and an Amplify row in the same dashboard', () => {
    const dashboard = DashboardSchema.parse({
      id: 'd1',
      name: 'Dashboard 1',
      credentials: [{ id: 'c1', kind: 'aws', label: 'AWS' }],
      rows: [
        {
          type: 'github',
          id: 'r1',
          repo: 'acme/api-core',
          displayName: 'api-core',
        },
        {
          type: 'amplify',
          id: 'r2',
          repo: 'acme/web-app',
          displayName: 'web-app',
          sources: [{ credentialId: 'c1', region: 'us-east-1', appId: 'd123' }],
        },
      ],
    });
    expect(dashboard.rows).toHaveLength(2);
    expect(dashboard.rows[0]?.type).toBe('github');
    expect(dashboard.rows[1]?.type).toBe('amplify');
  });

  it('rejects an Amplify row with no sources', () => {
    expect(() =>
      DashboardSchema.parse({
        id: 'd1',
        name: 'Dashboard 1',
        rows: [
          {
            type: 'amplify',
            id: 'r1',
            repo: 'acme/web-app',
            displayName: 'web-app',
            sources: [],
          },
        ],
      }),
    ).toThrow();
  });

  it('accepts an Amplify row without a repo, but not with a GitHub token', () => {
    const site = {
      type: 'amplify',
      id: 'site',
      displayName: 'site',
      sources: [{ region: 'eu-west-1', appId: 'a1' }],
    };
    const parse = (row: object) =>
      DashboardSchema.safeParse({
        id: 'd1',
        name: 'Dashboard 1',
        credentials: [{ id: 'gh', kind: 'github', label: 'gh' }],
        rows: [row],
      });
    const parsed = parse(site);
    expect(parsed.success && parsed.data.rows[0]).toMatchObject(site);
    expect(parse({ ...site, githubCredentialId: 'gh' }).error?.issues).toEqual([
      expect.objectContaining({
        path: ['rows', 0, 'githubCredentialId'],
        message: 'an Amplify row without a repo has no GitHub token',
      }),
    ]);
    expect(
      parse({ ...site, repo: 'acme/site', githubCredentialId: 'gh' }).success,
    ).toBe(true);
  });

  it('rejects a repo that is not owner/name', () => {
    expect(() =>
      DashboardSchema.parse({
        id: 'd1',
        name: 'Dashboard 1',
        rows: [
          {
            type: 'github',
            id: 'r1',
            repo: 'api-core',
            displayName: 'api-core',
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects a source-stage cycle', () => {
    expect(() =>
      DashboardSchema.parse({
        id: 'd1',
        name: 'Dashboard 1',
        stages: [
          {
            id: 's1',
            name: 'dev',
            rules: branchRules('dev'),
            sourceStageId: 's2',
          },
          {
            id: 's2',
            name: 'prod',
            rules: branchRules('main'),
            sourceStageId: 's1',
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects duplicate stage ids, even when they hide a self-cycle', () => {
    const parsed = DashboardSchema.safeParse({
      id: 'd1',
      name: 'Dashboard 1',
      stages: [
        {
          id: 's1',
          name: 'dev',
          rules: branchRules('dev'),
          sourceStageId: 's1',
        },
        { id: 's1', name: 'prod', rules: branchRules('main') },
      ],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe('duplicate stage id: s1');
  });

  it('rejects duplicate row ids, whatever the rows read', () => {
    const parsed = DashboardSchema.safeParse({
      id: 'd1',
      name: 'Dashboard 1',
      rows: [
        { type: 'github', id: 'r', repo: 'acme/api', displayName: 'api' },
        {
          type: 'amplify',
          id: 'r',
          repo: 'acme/web',
          displayName: 'web',
          sources: [{ region: 'us-east-1', appId: 'a1' }],
        },
      ],
    });
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({
        message: 'duplicate row id: r',
        path: ['rows', 1, 'id'],
      }),
    ]);
  });

  it('accepts an acyclic source-stage chain', () => {
    const dashboard = DashboardSchema.parse({
      id: 'd1',
      name: 'Dashboard 1',
      stages: [
        { id: 's1', name: 'dev', rules: branchRules('dev') },
        {
          id: 's2',
          name: 'prod',
          rules: branchRules('main'),
          sourceStageId: 's1',
        },
      ],
    });
    expect(dashboard.stages).toHaveLength(2);
  });

  it.each([
    [
      'an unknown member',
      { rowGroups: [{ id: 'g', memberIds: ['nope'] }] },
      'group g names unknown row: nope',
    ],
    [
      'a member in two groups',
      {
        columnGroups: [
          { id: 'a', memberIds: ['s'] },
          { id: 'b', memberIds: ['s'] },
        ],
      },
      'stage s is in groups a and b',
    ],
    [
      'two row groups with one id',
      {
        rowGroups: [
          { id: 'g', memberIds: ['r'] },
          { id: 'g', memberIds: ['r2'] },
        ],
      },
      'duplicate group id: g',
    ],
    [
      'two column groups with one id',
      {
        columnGroups: [
          { id: 'g', memberIds: ['s'] },
          { id: 'g', memberIds: ['s2'] },
        ],
      },
      'duplicate group id: g',
    ],
    [
      'a split row group',
      { rowGroups: [{ id: 'g', label: 'G', memberIds: ['r', 'r3'] }] },
      'group g is split: its rows are not together',
    ],
    [
      'a split column group',
      { columnGroups: [{ id: 'g', memberIds: ['s3', 's'] }] },
      'group g is split: its stages are not together',
    ],
  ])('rejects %s', (_label, groups, message) => {
    const result = DashboardSchema.safeParse({
      id: 'd',
      name: 'D',
      rows: ['r', 'r2', 'r3'].map((id) => ({
        type: 'github',
        id,
        repo: `o/${id}`,
        displayName: id,
      })),
      stages: ['s', 's2', 's3'].map((id) => ({
        id,
        name: id,
        rules: branchRules(id),
      })),
      ...groups,
    });
    expect(result.error?.issues.map((i) => i.message)).toEqual([message]);
  });

  it('loads unknown or other-source references (rule problems), but not a set for an unknown stage', () => {
    const bad = (extra: object) =>
      DashboardSchema.safeParse({ id: 'd', name: 'D', ...extra }).success;
    expect(bad({ statusSets: { github: 'nope' } })).toBe(true);
    expect(bad({ statusSets: { github: 'amplify' } })).toBe(true);
    expect(bad({ sourceRules: { github: 'nope', amplify: 'github' } })).toBe(
      true,
    );
    expect(
      bad({
        stages: [{ id: 'dev', name: 'dev', rules: branchRules('dev') }],
        rows: [
          {
            type: 'github',
            id: 'a',
            repo: 'acme/a',
            displayName: 'a',
            cellStatusSets: { prod: PRESET_IDS.githubSingleJob },
          },
        ],
      }),
    ).toBe(false);
    expect(bad({ statusSets: { github: PRESET_IDS.githubSingleJob } })).toBe(
      true,
    );
  });
});
