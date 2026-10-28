/**
 * Tests for override editing (spec.md C-14c, C-1a): set and clear branch
 * overrides on rows and row groups, a group's default credentials, and
 * whether a group carries settings that would be lost.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { branchRule } from '@/domain/rules/branch';

import {
  carriesSettings,
  setRowGroupOverride,
  setRowOverride,
} from './overrideEdit';

const base = DashboardSchema.parse({
  id: 'd',
  name: 'd',
  credentials: [{ id: 'tok', kind: 'github', label: 'tok' }],
  rows: [{ type: 'github', id: 'a', repo: 'o/a', displayName: 'a' }],
  stages: [{ id: 'prod', name: 'prod', rules: branchRules('main') }],
  rowGroups: [{ id: 'g', memberIds: ['a'] }],
});

describe('override editing', () => {
  it('sets a trimmed override and clears it with an empty pattern', () => {
    const row = setRowOverride(base, 'a', 'prod', ' develop ');
    expect(row.rows[0]?.stageRules).toEqual({ prod: branchRule('develop') });
    expect(setRowOverride(row, 'a', 'prod', ' ').rows[0]?.stageRules).toEqual(
      {},
    );
    const group = setRowGroupOverride(base, 'g', 'prod', 'release/*');
    expect(group.rowGroups[0]?.stageRules).toEqual({
      prod: branchRules('release/*'),
    });
  });

  it("knows when a group's disappearance would lose settings", () => {
    const group = (d: typeof base) => d.rowGroups[0] ?? base.rowGroups[0];
    expect(carriesSettings(group(base))).toBe(false);
    expect(
      carriesSettings({ ...group(base), settings: { githubToken: 'tok' } }),
    ).toBe(true);
    expect(
      carriesSettings({
        ...group(base),
        settings: { statusSets: { github: 'github-single-job' } },
      }),
    ).toBe(true);
    expect(
      carriesSettings(group(setRowGroupOverride(base, 'g', 'prod', 'x'))),
    ).toBe(true);
  });
});
