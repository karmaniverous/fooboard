/**
 * Tests for the first run's changes to the new dashboard: rows follow the
 * repos ticked (new ones in list order, unticked ones dropped with their
 * group), and new stages replace the old with everything keyed by them.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { branchRule } from '@/domain/rules/branch';

import { reposOf, withRepos, withStages } from './edits';

const board = DashboardSchema.parse({
  id: 'acme',
  name: 'Acme',
  rows: [
    { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
    { type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' },
    { type: 'amplify', id: 'site', repo: 'acme/site', displayName: 'site' },
  ],
  rowGroups: [{ id: 'g', label: 'G', memberIds: ['web'] }],
  stages: [{ id: 'old', name: 'old', rules: branchRules('dev') }],
});

describe('withRepos', () => {
  it('adds rows for newly ticked repos in list order and drops unticked ones', () => {
    const next = withRepos(
      board,
      new Set(['acme/api', 'acme/zeta', 'acme/docs']),
      ['acme/api', 'acme/docs', 'acme/web', 'acme/zeta'],
    );
    expect(reposOf(next)).toEqual(['acme/api', 'acme/docs', 'acme/zeta']);
    // An Amplify row isn't a repo pick: it stays.
    expect(next.rows.map((r) => r.id)).toContain('site');
    // web's group went with it.
    expect(next.rowGroups).toEqual([]);
  });
});

describe('withStages', () => {
  it('replaces the stages and drops what was keyed by the old ones', () => {
    const keyed = {
      ...board,
      rows: board.rows.map((r) => ({
        ...r,
        stageRules: { old: branchRule('x') },
        cellSettings: { old: { githubToken: 'gh' } },
      })),
    };
    const stages = [
      { id: 'new', name: 'new', rules: branchRules('main'), settings: {} },
    ];
    const next = withStages(keyed, stages);
    expect(next.stages).toEqual(stages);
    expect(next.rows.map((r) => [r.stageRules, r.cellSettings])).toEqual([
      [{}, {}],
      [{}, {}],
      [{}, {}],
    ]);
  });
});
