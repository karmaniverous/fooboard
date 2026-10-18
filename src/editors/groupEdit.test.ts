/**
 * Tests for group editing on a dashboard (spec.md C-14b, C-21): the
 * lifecycle on both axes (created from a member, joined, left, renamed,
 * deleted, gone with its last member) and the list handlers for drags
 * and steps. The arranging rules themselves are tested in the domain.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { type Dashboard, DashboardSchema } from '@/domain/config/dashboard';

import {
  deleteGroup,
  listHandlers,
  renameGroup,
  setGroup,
  tidyGroups,
} from './groupEdit';

const base = DashboardSchema.parse({
  id: 'd',
  name: 'd',
  rows: ['a', 'b', 'c', 'd'].map((id) => ({
    type: 'github',
    id,
    repo: `o/${id}`,
    displayName: id,
  })),
  stages: [
    { id: 'dev', name: 'dev', branchPattern: 'dev' },
    { id: 'prod', name: 'prod', branchPattern: 'main' },
  ],
});
const rowIds = (d: Dashboard) => d.rows.map((r) => r.id);

describe('group lifecycle', () => {
  it('creates a row group from a member, takes others in next to it', () => {
    const one = setGroup(base, 'rows', 'b', 'new');
    expect(one.rowGroups).toEqual([
      {
        id: 'group-b',
        memberIds: ['b'],
        branchPatternOverrides: {},
        defaultCredentials: {},
      },
    ]);
    const two = setGroup(one, 'rows', 'd', 'group-b');
    expect(rowIds(two)).toEqual(['a', 'b', 'd', 'c']);
    expect(two.rowGroups[0]?.memberIds).toEqual(['b', 'd']);
  });

  it('moves between groups and out; a group goes with its last member', () => {
    let d = setGroup(base, 'rows', 'a', 'new');
    d = setGroup(d, 'rows', 'c', 'new');
    d = setGroup(d, 'rows', 'a', 'group-c');
    expect(d.rowGroups.map((g) => [g.id, g.memberIds])).toEqual([
      ['group-c', ['a', 'c']],
    ]);
    d = setGroup(setGroup(d, 'rows', 'a', null), 'rows', 'c', null);
    expect(d.rowGroups).toEqual([]);
  });

  it('labels (an empty label clears it) and deletes, on either axis', () => {
    let d = setGroup(base, 'stages', 'prod', 'new');
    expect(d.columnGroups).toEqual([{ id: 'group-prod', memberIds: ['prod'] }]);
    d = renameGroup(d, 'stages', 'group-prod', ' Production ');
    expect(d.columnGroups[0]?.label).toBe('Production');
    expect(
      renameGroup(d, 'stages', 'group-prod', '').columnGroups[0]?.label,
    ).toBeUndefined();
    expect(deleteGroup(d, 'stages', 'group-prod').columnGroups).toEqual([]);
    expect(deleteGroup(d, 'stages', 'group-prod').stages).toEqual(d.stages);
  });

  it('tidies groups after their items change', () => {
    const d = setGroup(base, 'rows', 'a', 'new');
    const removed = { ...d, rows: d.rows.filter((r) => r.id !== 'a') };
    expect(tidyGroups(removed, 'rows').rowGroups).toEqual([]);
  });
});

describe('listHandlers', () => {
  it('commits drops and offers only the steps that can happen', () => {
    const grouped = setGroup(base, 'rows', 'b', 'new');
    const onChange = vi.fn<(d: Dashboard) => void>();
    const { onDrop, onStep } = listHandlers(grouped, 'rows', onChange);
    onDrop({ id: 'd' }, { id: 'b' });
    expect(rowIds(onChange.mock.calls[0]?.[0] ?? grouped)).toEqual([
      'a',
      'd',
      'b',
      'c',
    ]);
    expect(onStep({ id: 'a' }, -1)).toBeUndefined();
    onStep({ id: 'b' }, 1)?.();
    expect(onChange.mock.calls[1]?.[0].rowGroups).toEqual([]);
  });
});
