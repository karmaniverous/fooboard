/**
 * Tests for group editing (spec.md C-14b, C-21): groups are created from
 * a member, members move in, out and between groups, groups stay
 * contiguous through reorders, and a group disappears with its last
 * member.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';

import { duplicateDashboard } from './edit';
import {
  deleteRowGroup,
  regroup,
  renameRowGroup,
  reorderRows,
  setColumnGroup,
  setRowGroup,
  setRowGroupCredential,
  setRowGroupOverride,
  setRowOverride,
} from './groupEdit';

const row = (id: string) => ({
  type: 'github' as const,
  id,
  repo: `o/${id}`,
  displayName: id,
});
const base = DashboardSchema.parse({
  id: 'd',
  name: 'd',
  rows: ['a', 'b', 'c', 'd'].map(row),
  stages: [
    { id: 'dev', name: 'dev', branchPattern: 'dev' },
    { id: 'prod', name: 'prod', branchPattern: 'main' },
  ],
});
const ids = (d: { rows: { id: string }[] }) => d.rows.map((r) => r.id);

describe('regroup', () => {
  it('pulls members together at the first member and drops empty groups', () => {
    const items = ['a', 'b', 'c'].map((id) => ({ id }));
    const out = regroup(items, [
      { id: 'g', memberIds: ['c', 'a'] },
      { id: 'empty', memberIds: ['zz'] },
    ]);
    expect(out.items.map((i) => i.id)).toEqual(['a', 'c', 'b']);
    expect(out.groups).toEqual([{ id: 'g', memberIds: ['a', 'c'] }]);
  });
});

describe('row group lifecycle', () => {
  it('creates from a member, takes others in, and keeps them adjacent', () => {
    const one = setRowGroup(base, 'b', 'new');
    expect(one.rowGroups).toEqual([
      {
        id: 'group-b',
        memberIds: ['b'],
        branchPatternOverrides: {},
        defaultCredentials: {},
      },
    ]);
    const two = setRowGroup(one, 'd', 'group-b');
    expect(ids(two)).toEqual(['a', 'b', 'd', 'c']);
    expect(two.rowGroups[0]?.memberIds).toEqual(['b', 'd']);
  });

  it('moves a row between groups and out, and the group goes with its last member', () => {
    let d = setRowGroup(base, 'a', 'new');
    d = setRowGroup(d, 'c', 'new');
    d = setRowGroup(d, 'a', 'group-c');
    expect(d.rowGroups.map((g) => g.id)).toEqual(['group-c']);
    expect(d.rowGroups[0]?.memberIds).toEqual(['a', 'c']);
    d = setRowGroup(d, 'a', null);
    d = setRowGroup(d, 'c', null);
    expect(d.rowGroups).toEqual([]);
  });

  it('renames, deletes, and stays contiguous after a reorder', () => {
    let d = setRowGroup(base, 'a', 'new');
    d = setRowGroup(d, 'b', 'group-a');
    d = renameRowGroup(d, 'group-a', ' Backend ');
    expect(d.rowGroups[0]?.label).toBe('Backend');
    expect(renameRowGroup(d, 'group-a', '').rowGroups[0]).not.toHaveProperty(
      'label',
    );
    const [a, b, c, last] = d.rows;
    const moved = reorderRows(d, [a, c, b, last]);
    expect(ids(moved)).toEqual(['a', 'b', 'c', 'd']);
    expect(deleteRowGroup(d, 'group-a').rowGroups).toEqual([]);
  });

  it('groups columns the same way', () => {
    const d = setColumnGroup(base, 'prod', 'new');
    expect(d.columnGroups).toEqual([{ id: 'group-prod', memberIds: ['prod'] }]);
  });
});

describe('overrides and group credentials', () => {
  it('sets and clears row and row-group overrides and group credentials', () => {
    let d = setRowGroup(base, 'a', 'new');
    d = setRowGroupOverride(d, 'group-a', 'prod', 'release/*');
    d = setRowOverride(d, 'a', 'dev', ' develop ');
    d = setRowGroupCredential(d, 'group-a', 'github', 'tok');
    expect(d.rowGroups[0]?.branchPatternOverrides).toEqual({
      prod: 'release/*',
    });
    expect(d.rowGroups[0]?.defaultCredentials.github).toBe('tok');
    expect(d.rows[0]?.branchPatternOverrides).toEqual({ dev: 'develop' });
    expect(
      setRowOverride(d, 'a', 'dev', '').rows[0]?.branchPatternOverrides,
    ).toEqual({});
  });

  it('survive duplication (C-21)', () => {
    let d = setRowGroup(base, 'a', 'new');
    d = setRowGroupOverride(d, 'group-a', 'prod', 'release/*');
    const copy = duplicateDashboard(d, 'copy', 'Copy', (id) => id);
    expect(copy.rowGroups).toEqual(d.rowGroups);
  });
});
