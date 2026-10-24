/**
 * Tests for status-set resolution: a cell uses the set the settings
 * resolver gives it, falling back to the provider's default preset for a
 * dangling id or another source's set; and the integrity issues the
 * dashboard schema reports.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import type { Row } from '@/domain/config/row';
import { PRESET_IDS } from '@/domain/config/statusSets';

import { presetById } from './presets';
import { statusSetFor, statusSetReferenceIssues } from './resolve';

const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
  rows: [{ type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' }],
  rowGroups: [{ id: 'g', memberIds: ['web'] }],
});
const [web] = dashboard.rows;
const withRow = (
  change: Pick<Row, 'settings'> | Pick<Row, 'cellSettings'>,
): Row => ({
  ...web,
  ...change,
});
const choosing = (id: string) => ({
  ...dashboard,
  rows: [withRow({ settings: { statusSets: { github: id } } })],
});

describe('statusSetFor', () => {
  it('uses the set the cell resolves to', () => {
    expect(statusSetFor(choosing(PRESET_IDS.githubSingleJob), web, 'dev')).toBe(
      presetById(PRESET_IDS.githubSingleJob),
    );
  });

  it("uses the provider's default preset when nothing chooses one", () => {
    expect(statusSetFor(dashboard, web, 'dev')).toBe(
      presetById(PRESET_IDS.githubDeployTest),
    );
  });

  it.each([
    ['a dangling id', 'gone'],
    ["another source's set", PRESET_IDS.amplify],
  ])("falls back to the provider's default preset for %s", (_label, id) => {
    expect(statusSetFor(choosing(id), web, 'dev')).toBe(
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
      rows: [
        withRow({
          cellSettings: {
            dev: { statusSets: { github: 'gone' } },
            qa: { statusSets: { github: PRESET_IDS.githubSingleJob } },
          },
        }),
      ],
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
        message: 'settings for unknown stage: qa',
        path: ['rows', 0, 'cellSettings', 'qa'],
      },
    ]);
  });
});
