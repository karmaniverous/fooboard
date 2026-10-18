/**
 * Tests for arranging items and groups (spec.md C-14b): groups pulled
 * together, membership moves, new group ids, and drags and steps across
 * group edges.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { assign, dropOnto, newGroupId, regroup, step } from './arrange';

const items = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (a: { items: { id: string }[] }) => a.items.map((i) => i.id);
const members = (a: { groups: { memberIds: string[] }[] }) =>
  a.groups.map((g) => g.memberIds);
// a | [b c] | d
const grouped = {
  items: items('a', 'b', 'c', 'd'),
  groups: [{ id: 'g', memberIds: ['b', 'c'] }],
};

describe('regroup', () => {
  it('pulls members together at the first member and drops empty groups', () => {
    const out = regroup(items('a', 'b', 'c'), [
      { id: 'g', memberIds: ['c', 'a'] },
      { id: 'empty', memberIds: ['zz'] },
    ]);
    expect(ids(out)).toEqual(['a', 'c', 'b']);
    expect(out.groups).toEqual([{ id: 'g', memberIds: ['a', 'c'] }]);
  });
});

describe('membership', () => {
  it('moves an id into a group or out of every group', () => {
    const groups = [
      { id: 'x', memberIds: ['a'] },
      { id: 'y', memberIds: ['b'] },
    ];
    expect(assign(groups, 'a', 'y').map((g) => g.memberIds)).toEqual([
      [],
      ['b', 'a'],
    ]);
    expect(assign(groups, 'b', undefined)[1]?.memberIds).toEqual([]);
  });

  it('derives new group ids from the first member, avoiding taken ones', () => {
    expect(newGroupId('api', [])).toBe('group-api');
    expect(
      newGroupId('api', [{ id: 'group-api' }, { id: 'group-api-2' }]),
    ).toBe('group-api-3');
  });
});

describe('dropOnto', () => {
  it.each([
    ['into a group', 'd', 'b', ['a', 'd', 'b', 'c'], [['d', 'b', 'c']]],
    ['out of a group', 'c', 'd', ['a', 'b', 'd', 'c'], [['b']]],
    ['within a group', 'c', 'b', ['a', 'c', 'b', 'd'], [['c', 'b']]],
  ])(
    'moves %s: its place and the target group',
    (_l, from, to, order, groups) => {
      const out = dropOnto(grouped, from, to);
      expect(ids(out)).toEqual(order);
      expect(members(out)).toEqual(groups);
    },
  );

  it('moves between groups, and ignores unknown or self drops', () => {
    const two = {
      ...grouped,
      groups: [...grouped.groups, { id: 'h', memberIds: ['d'] }],
    };
    expect(members(dropOnto(two, 'c', 'd'))).toEqual([['b'], ['d', 'c']]);
    expect(dropOnto(grouped, 'a', 'a')).toEqual(grouped);
    expect(dropOnto(grouped, 'zz', 'a')).toEqual(grouped);
  });
});

describe('step', () => {
  it.each([
    ['leaves its group at the edge', 'c', 1, ['a', 'b', 'c', 'd'], [['b']]],
    [
      'joins a neighbouring group',
      'a',
      1,
      ['a', 'b', 'c', 'd'],
      [['a', 'b', 'c']],
    ],
    ['swaps inside a group', 'b', 1, ['a', 'c', 'b', 'd'], [['c', 'b']]],
    [
      'joins a group from below',
      'd',
      -1,
      ['a', 'b', 'c', 'd'],
      [['b', 'c', 'd']],
    ],
  ] as const)('%s', (_l, id, delta, order, groups) => {
    const out = step(grouped, id, delta);
    expect(out && ids(out)).toEqual(order);
    expect(out && members(out)).toEqual(groups);
  });

  it("swaps ungrouped neighbours; can't pass the ends unless leaving a group", () => {
    expect(step({ items: items('a', 'b'), groups: [] }, 'a', 1)?.items).toEqual(
      items('b', 'a'),
    );
    expect(step(grouped, 'a', -1)).toBeUndefined();
    expect(step(grouped, 'zz', 1)).toBeUndefined();
    const top = { items: items('a'), groups: [{ id: 'g', memberIds: ['a'] }] };
    expect(step(top, 'a', -1)?.groups).toEqual([]);
  });
});
