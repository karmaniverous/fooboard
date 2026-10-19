/**
 * Tests for status-set resolution: the level that chose a cell's set, the
 * set a row inherits, the default-preset fallback for a dangling id, and
 * every reference problem the dashboard schema reports.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import type { Row } from '@/domain/config/row';
import { PRESET_IDS } from '@/domain/config/statusSets';

import { presetById } from './presets';
import {
  inheritedStatusSetId,
  statusSetFor,
  statusSetReferenceIssues,
  statusSetSource,
} from './resolve';

const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
  rows: [{ type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' }],
  rowGroups: [{ id: 'g', memberIds: ['web'] }],
});
const [web] = dashboard.rows;
const withRow = (
  change: Partial<Pick<Row, 'statusSet' | 'cellStatusSets'>>,
): Row => ({ ...web, ...change });
const grouped = {
  ...dashboard,
  rowGroups: [
    {
      ...dashboard.rowGroups[0],
      statusSets: { github: PRESET_IDS.githubSingleJob },
    },
  ],
};

describe('statusSetSource', () => {
  it('names the level that chose the set', () => {
    expect(statusSetSource(dashboard, web, 'dev')).toEqual({
      id: PRESET_IDS.githubDeployTest,
      from: 'dashboard',
    });
    expect(statusSetSource(grouped, web, 'dev')).toEqual({
      id: PRESET_IDS.githubSingleJob,
      from: 'rowGroup',
      groupId: 'g',
    });
    expect(
      statusSetSource(
        grouped,
        withRow({ statusSet: PRESET_IDS.githubDeployTest }),
        'dev',
      ),
    ).toEqual({ id: PRESET_IDS.githubDeployTest, from: 'row' });
    expect(
      statusSetSource(
        grouped,
        withRow({
          statusSet: PRESET_IDS.githubDeployTest,
          cellStatusSets: { dev: 'x' },
        }),
        'dev',
      ),
    ).toEqual({ id: 'x', from: 'cell' });
  });

  it("gives a row its group's set to inherit, ignoring its own choice", () => {
    expect(
      inheritedStatusSetId(
        grouped,
        withRow({ statusSet: PRESET_IDS.githubDeployTest }),
      ),
    ).toBe(PRESET_IDS.githubSingleJob);
    expect(inheritedStatusSetId(dashboard, web)).toBe(
      PRESET_IDS.githubDeployTest,
    );
  });
});

describe('statusSetFor', () => {
  it("falls back to the provider's default preset for a dangling id", () => {
    expect(statusSetFor(dashboard, withRow({ statusSet: 'gone' }), 'dev')).toBe(
      presetById(PRESET_IDS.githubDeployTest),
    );
  });
});

describe('statusSetReferenceIssues', () => {
  it('reports integrity issues at their paths, not dangling references', () => {
    const custom = { ...presetById(PRESET_IDS.amplify), id: 'mine' };
    const issues = statusSetReferenceIssues({
      ...dashboard,
      customStatusSets: [custom, custom, { ...custom, id: 'amplify' }],
      rows: [withRow({ cellStatusSets: { qa: PRESET_IDS.githubSingleJob } })],
    });
    expect(issues).toEqual([
      {
        message: 'duplicate status set id: mine',
        path: ['customStatusSets', 1, 'id'],
      },
      {
        message: "status set id amplify is a preset's",
        path: ['customStatusSets', 2, 'id'],
      },
      {
        message: 'status set for unknown stage: qa',
        path: ['rows', 0, 'cellStatusSets', 'qa'],
      },
    ]);
  });
});
