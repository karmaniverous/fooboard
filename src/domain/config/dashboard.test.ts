/**
 * Tests for `DashboardSchema`: defaults for mapping, colors and
 * dividers/credentials, GitHub/Amplify row discrimination, and the
 * source-stage cycle guard.
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
  it('applies mapping, color, divider and credential defaults', () => {
    const dashboard = DashboardSchema.parse({ id: 'd1', name: 'Dashboard 1' });
    expect(dashboard.mapping.phases.deploy).toEqual(DEFAULT_DEPLOY_PHASE_TESTS);
    expect(dashboard.mapping.phases.test).toEqual(DEFAULT_TEST_PHASE_TESTS);
    expect(dashboard.mapping.workflowFilter).toEqual({
      include: [],
      exclude: [],
    });
    expect(dashboard.statusColors).toEqual(DEFAULT_STATUS_COLORS);
    expect(dashboard.rowDividers).toEqual([]);
    expect(dashboard.columnDividers).toEqual([]);
    expect(dashboard.credentials).toEqual([]);
    expect(dashboard.rows).toEqual([]);
  });

  it('parses a GitHub row and an Amplify row in the same dashboard', () => {
    const dashboard = DashboardSchema.parse({
      id: 'd1',
      name: 'Dashboard 1',
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
});
