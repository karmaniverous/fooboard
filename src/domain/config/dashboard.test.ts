/**
 * Tests for `DashboardSchema`: defaults for mapping, colors, groups and
 * credentials, GitHub/Amplify row discrimination, the source-stage cycle
 * guard, and group membership checks.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_STATUS_COLORS } from './colors';
import { DashboardSchema } from './dashboard';
import {
  DEFAULT_DEPLOY_PHASE_TESTS,
  DEFAULT_TEST_PHASE_TESTS,
} from './mappingSettings';

describe('DashboardSchema', () => {
  it('applies mapping, color, group and credential defaults', () => {
    const dashboard = DashboardSchema.parse({ id: 'd1', name: 'Dashboard 1' });
    expect(dashboard.mapping.phases.deploy).toEqual(DEFAULT_DEPLOY_PHASE_TESTS);
    expect(dashboard.mapping.phases.test).toEqual(DEFAULT_TEST_PHASE_TESTS);
    expect(dashboard.mapping.workflowFilter).toEqual({
      include: [],
      exclude: [],
    });
    expect(dashboard.statusColors).toEqual(DEFAULT_STATUS_COLORS);
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
          { id: 's1', name: 'dev', branchPattern: 'dev', sourceStageId: 's2' },
          {
            id: 's2',
            name: 'prod',
            branchPattern: 'main',
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
        { id: 's1', name: 'dev', branchPattern: 'dev', sourceStageId: 's1' },
        { id: 's1', name: 'prod', branchPattern: 'main' },
      ],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe('duplicate stage id: s1');
  });

  it('accepts an acyclic source-stage chain', () => {
    const dashboard = DashboardSchema.parse({
      id: 'd1',
      name: 'Dashboard 1',
      stages: [
        { id: 's1', name: 'dev', branchPattern: 'dev' },
        { id: 's2', name: 'prod', branchPattern: 'main', sourceStageId: 's1' },
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
        branchPattern: id,
      })),
      ...groups,
    });
    expect(result.error?.issues.map((i) => i.message)).toEqual([message]);
  });
});
