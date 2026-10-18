/**
 * Tests for status-set resolution: the level that chose a cell's set, the
 * set a row inherits, the default-preset fallback for a dangling id, and
 * every reference problem the dashboard schema reports.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import type { Row } from '@/domain/config/row';

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
  stages: [{ id: 'dev', name: 'Dev', branchPattern: 'dev' }],
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
    { ...dashboard.rowGroups[0], statusSets: { github: 'github-single-job' } },
  ],
};

describe('statusSetSource', () => {
  it('names the level that chose the set', () => {
    expect(statusSetSource(dashboard, web, 'dev')).toEqual({
      id: 'github-deploy-test',
      from: 'dashboard',
    });
    expect(statusSetSource(grouped, web, 'dev')).toEqual({
      id: 'github-single-job',
      from: 'rowGroup',
      groupId: 'g',
    });
    expect(
      statusSetSource(
        grouped,
        withRow({ statusSet: 'github-deploy-test' }),
        'dev',
      ),
    ).toEqual({ id: 'github-deploy-test', from: 'row' });
    expect(
      statusSetSource(
        grouped,
        withRow({
          statusSet: 'github-deploy-test',
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
        withRow({ statusSet: 'github-deploy-test' }),
      ),
    ).toBe('github-single-job');
    expect(inheritedStatusSetId(dashboard, web)).toBe('github-deploy-test');
  });
});

describe('statusSetFor', () => {
  it("falls back to the provider's default preset for a dangling id", () => {
    expect(statusSetFor(dashboard, withRow({ statusSet: 'gone' }), 'dev')).toBe(
      presetById('github-deploy-test'),
    );
  });
});

describe('statusSetReferenceIssues', () => {
  it('reports each bad reference at its path', () => {
    const custom = { ...presetById('amplify'), id: 'mine' };
    const issues = statusSetReferenceIssues({
      ...dashboard,
      customStatusSets: [custom, custom, { ...custom, id: 'amplify' }],
      statusSets: { github: 'mine', amplify: 'amplify' },
      rowGroups: [
        { ...dashboard.rowGroups[0], statusSets: { github: 'nope' } },
      ],
      rows: [withRow({ cellStatusSets: { qa: 'github-single-job' } })],
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
        message: 'status set mine is for amplify, expected github',
        path: ['statusSets', 'github'],
      },
      {
        message: 'unknown status set: nope',
        path: ['rowGroups', 0, 'statusSets', 'github'],
      },
      {
        message: 'status set for unknown stage: qa',
        path: ['rows', 0, 'cellStatusSets', 'qa'],
      },
    ]);
  });
});
